import {
  ErrorWithKey,
  errorWithKeyToJSON,
  getJWKS,
  isErrorWithKey,
  withResolvers,
  Timeout,
  type ErrorWithKeyLike,
} from '@/shared/helpers';
import { createTab } from '@/background/utils';
import type { Browser, Runtime, Scripting } from 'webextension-polyfill';
import type { WalletAddress } from '@interledger/open-payments';
import type { TabId } from '@/shared/types';
import type { Cradle } from '@/background/container';
import type {
  BeginPayload,
  KeyAutoAddToBackgroundMessage,
  StepWithStatus,
} from '@/content/keyAutoAdd/lib/types';

export const CONNECTION_NAME = 'key-auto-add';

type OnTabRemovedCallback = Parameters<
  Browser['tabs']['onRemoved']['addListener']
>[0];
type OnConnectCallback = Parameters<
  Browser['runtime']['onConnect']['addListener']
>[0];
type OnPortMessageListener = Parameters<
  Runtime.Port['onMessage']['addListener']
>[0];

export class KeyAutoAddService {
  private browser: Cradle['browser'];
  private storage: Cradle['storage'];
  private appName: Cradle['appName'];
  private browserName: Cradle['browserName'];
  private t: Cradle['t'];

  constructor({
    browser,
    storage,
    appName,
    browserName,
    t,
  }: Pick<Cradle, 'browser' | 'storage' | 'appName' | 'browserName' | 't'>) {
    Object.assign(this, { browser, storage, appName, browserName, t });
  }

  async addPublicKeyToWallet(
    walletAddress: WalletAddress,
    onTabOpen: (tabId: TabId) => void,
  ) {
    const keyAddUrl = walletAddressToProvider(walletAddress);
    try {
      const { publicKey, keyId } = await this.storage.get([
        'publicKey',
        'keyId',
      ]);
      this.setConnectState(this.t('connectWalletKeyService_text_stepAddKey'));
      await this.process(
        keyAddUrl,
        {
          publicKey,
          keyId,
          walletAddressUrl: walletAddress.id,
          nickName: `${this.appName} Extension - ${this.browserName}`,
          keyAddUrl,
        },
        onTabOpen,
      );
      await this.validate(walletAddress.id, keyId);
    } catch (error) {
      if (!error.key || !error.key.startsWith('connectWallet_error_')) {
        this.setConnectStateError(error);
      }
      throw error;
    }
  }

  private async process(
    url: string,
    payload: BeginPayload,
    onTabOpen: (tabId: TabId) => void,
  ): Promise<unknown> {
    const { resolve, reject, promise } = withResolvers();

    const BASE_TIMEOUT = 5 * 1000;
    const timeout = new Timeout(BASE_TIMEOUT, () => {
      removeListeners();
      reject(new ErrorWithKey('connectWallet_error_timeout'));
    });

    const tabID = await createTab(this.browser, url);
    onTabOpen(tabID);

    const removeListeners = () => {
      timeout.clear();
      this.browser.tabs.onRemoved.removeListener(onTabCloseListener);
      this.browser.runtime.onConnect.removeListener(onConnectListener);
    };

    const onTabCloseListener: OnTabRemovedCallback = (tabId) => {
      if (tabId !== tabID) return;
      removeListeners();
      reject(new ErrorWithKey('connectWallet_error_tabClosed'));
    };

    const ports = new Set<Runtime.Port>();
    const onConnectListener: OnConnectCallback = (port) => {
      if (port.name !== CONNECTION_NAME) return;
      if (port.sender?.tab && port.sender.tab.id !== tabID) return;
      if (port.error) {
        removeListeners();
        reject(new Error(port.error.message));
        return;
      }
      ports.add(port);

      port.postMessage({ action: 'BEGIN', payload });

      port.onMessage.addListener(onMessageListener);

      port.onDisconnect.addListener(() => {
        ports.delete(port);
        // wait for connect again so we can send message again if not connected,
        // and not errored already (e.g. page refreshed)
      });
    };

    const onMessageListener: OnPortMessageListener = (
      message: KeyAutoAddToBackgroundMessage,
      port,
    ) => {
      if (message.action === 'SUCCESS') {
        removeListeners();
        resolve(message.payload);
      } else if (message.action === 'ERROR') {
        removeListeners();
        const { stepName, details: err } = message.payload;
        reject(
          new ErrorWithKey(
            'connectWalletKeyService_error_failed',
            [
              stepName,
              isErrorWithKey(err.error) ? this.t(err.error) : err.message,
            ],
            isErrorWithKey(err.error) ? err.error : undefined,
          ),
        );
      } else if (message.action === 'PROGRESS') {
        const steps = message.payload.steps;
        const timeoutMs = steps
          .filter(({ status }) => status === 'pending' || status === 'active')
          .reduce((acc, { maxDuration }) => acc + maxDuration, 0);
        timeout.reset(Math.max(timeoutMs, BASE_TIMEOUT));
        const currentStep = this.getCurrentStep(steps);
        if (currentStep) {
          this.setConnectState(currentStep.name);
        }
        for (const p of ports) {
          if (p !== port) p.postMessage(message);
        }
      } else {
        removeListeners();
        reject(new Error(`Unexpected message: ${JSON.stringify(message)}`));
      }
    };

    this.browser.tabs.onRemoved.addListener(onTabCloseListener);
    this.browser.runtime.onConnect.addListener(onConnectListener);

    return promise;
  }

  private getCurrentStep(steps: Readonly<StepWithStatus[]>) {
    return steps
      .slice()
      .reverse()
      .find((step) => step.status !== 'pending');
  }

  private async validate(walletAddressUrl: string, keyId: string) {
    const jwks = await getJWKS(walletAddressUrl);
    if (!jwks.keys.find((key) => key.kid === keyId)) {
      throw new Error('Key not found in jwks');
    }
  }

  private setConnectState(currentStep: string) {
    this.storage.setPopupTransientState('connect', () => ({
      status: 'connecting:key',
      currentStep,
    }));
  }

  private setConnectStateError(err: ErrorWithKeyLike | { message: string }) {
    this.storage.setPopupTransientState('connect', () => ({
      status: 'error:key',
      error: isErrorWithKey(err) ? errorWithKeyToJSON(err) : err.message,
    }));
  }

  static supports(walletAddress: WalletAddress): boolean {
    try {
      walletAddressToProvider(walletAddress);
      return true;
    } catch {
      return false;
    }
  }

  static async registerContentScripts({ browser }: Pick<Cradle, 'browser'>) {
    const { scripting } = browser;
    const existingScripts = await scripting.getRegisteredContentScripts();
    const existingScriptIds = new Set(existingScripts.map((s) => s.id));
    const scripts = CONTENT_SCRIPTS.filter((s) => !existingScriptIds.has(s.id));
    await scripting.registerContentScripts(scripts);
  }
}

const CONTENT_SCRIPTS: Scripting.RegisteredContentScript[] = [
  {
    id: 'keyAutoAdd/testWallet/test',
    matches: ['https://wallet.interledger-test.dev/*'],
    js: ['content/keyAutoAdd/testWallet.js'],
    persistAcrossSessions: false,
  },
  {
    id: 'keyAutoAdd/testWallet/cards',
    matches: ['https://wallet.interledger.cards/*'],
    js: ['content/keyAutoAdd/testWallet.js'],
    persistAcrossSessions: false,
  },
  {
    id: 'keyAutoAdd/fynbos/sandbox',
    matches: ['https://sandbox.interledger.app/*'],
    js: ['content/keyAutoAdd/fynbos.js'],
    persistAcrossSessions: false,
  },
  {
    id: 'keyAutoAdd/fynbos/prod',
    matches: ['https://interledger.app/*'],
    js: ['content/keyAutoAdd/fynbos.js'],
    persistAcrossSessions: false,
  },
  {
    id: 'keyAutoAdd/chimoney/sandbox',
    matches: ['https://sandbox.chimoney.io/*'],
    js: ['content/keyAutoAdd/chimoney.js'],
    persistAcrossSessions: false,
  },
  {
    id: 'keyAutoAdd/chimoney/prod',
    matches: ['https://dash.chimoney.io/*'],
    js: ['content/keyAutoAdd/chimoney.js'],
    persistAcrossSessions: false,
  },
  {
    id: 'keyAutoAdd/gatehub/sandbox',
    matches: [
      'https://wallet.sandbox.gatehub.net/*',
      'https://signin.sandbox.gatehub.net/*',
    ],
    js: ['content/keyAutoAdd/gatehub.js'],
    persistAcrossSessions: false,
  },
  {
    id: 'keyAutoAdd/gatehub/prod',
    matches: ['https://wallet.gatehub.net/*', 'https://signin.gatehub.net/*'],
    js: ['content/keyAutoAdd/gatehub.js'],
    persistAcrossSessions: false,
  },
];

function walletAddressToProvider(walletAddress: WalletAddress): string {
  const { host } = new URL(walletAddress.id);
  switch (host) {
    case 'ilp.interledger-test.dev':
      return 'https://wallet.interledger-test.dev/settings/developer-keys';
    case 'ilp.interledger.cards':
      return 'https://wallet.interledger.cards/settings/developer-keys';
    case 'sandbox.ilp.link':
      return 'https://sandbox.interledger.app/settings/keys';
    case 'fynbos.me':
    case 'ilp.link':
      return 'https://interledger.app/settings/keys';
    case 'ilp-sandbox.chimoney.com':
      return 'https://sandbox.chimoney.io/interledger';
    case 'ilp.chimoney.com':
      return 'https://dash.chimoney.io/interledger';
    case 'ilp.sandbox.gatehub.net':
      return 'https://wallet.sandbox.gatehub.net/#/wallets/';
    case 'ilp.gatehub.net':
      return 'https://wallet.gatehub.net/#/wallets/';
    default:
      throw new ErrorWithKey('connectWalletKeyService_error_notImplemented');
  }
}
