import {
  ErrorWithKey,
  errorWithKeyToJSON,
  getJWKS,
  isErrorWithKey,
  withResolvers,
  type ErrorWithKeyLike,
} from '@/shared/helpers';
import type { Browser, Runtime, Scripting } from 'webextension-polyfill';
import type { WalletAddress } from '@interledger/open-payments';
import type { Tab, TabId } from '@/shared/types';
import type { Cradle } from '@/background/container';
import type {
  BeginPayload,
  KeyAutoAddToBackgroundMessage,
} from '@/content/keyAutoAdd/lib/types';
import { reuseOrCreateTab } from '../utils';

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

  private tab: Tab | null = null;

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
    existingTabId?: TabId,
  ) {
    const keyAddUrl = walletAddressToProvider(walletAddress);
    try {
      const { publicKey, keyId } = await this.storage.get([
        'publicKey',
        'keyId',
      ]);
      this.updateConnectState();
      await this.process(
        keyAddUrl,
        {
          publicKey,
          keyId,
          walletAddressUrl: walletAddress.id,
          nickName: `${this.appName} Extension - ${this.browserName}`,
          keyAddUrl,
        },
        existingTabId,
      );
      await this.validate(walletAddress.id, keyId);
    } catch (error) {
      if (!error.key || !error.key.startsWith('connectWallet_error_')) {
        this.updateConnectState(error);
      }
      throw error;
    }
  }

  /**
   * Allows re-using same tab for further processing. Available only after
   * {@linkcode addPublicKeyToWallet} has been called.
   */
  get tabId(): TabId | undefined {
    return this.tab?.id;
  }

  private async process(
    url: string,
    payload: BeginPayload,
    existingTabId?: TabId,
  ): Promise<unknown> {
    const { resolve, reject, promise } = withResolvers();
    const tab = await reuseOrCreateTab(this.browser, url, existingTabId);
    this.tab = tab;

    const onTabCloseListener: OnTabRemovedCallback = (tabId) => {
      if (tabId !== tab.id) return;
      this.browser.tabs.onRemoved.removeListener(onTabCloseListener);
      reject(new ErrorWithKey('connectWallet_error_tabClosed'));
    };
    this.browser.tabs.onRemoved.addListener(onTabCloseListener);

    const ports = new Set<Runtime.Port>();
    const onConnectListener: OnConnectCallback = (port) => {
      if (port.name !== CONNECTION_NAME) return;
      if (port.error) {
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
        this.browser.runtime.onConnect.removeListener(onConnectListener);
        this.browser.tabs.onRemoved.removeListener(onTabCloseListener);
        resolve(message.payload);
      } else if (message.action === 'ERROR') {
        this.browser.runtime.onConnect.removeListener(onConnectListener);
        this.browser.tabs.onRemoved.removeListener(onTabCloseListener);
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
        // can also save progress to show in popup
        for (const p of ports) {
          if (p !== port) p.postMessage(message);
        }
      } else {
        reject(new Error(`Unexpected message: ${JSON.stringify(message)}`));
      }
    };

    this.browser.runtime.onConnect.addListener(onConnectListener);

    return promise;
  }

  private async validate(walletAddressUrl: string, keyId: string) {
    const jwks = await getJWKS(walletAddressUrl);
    if (!jwks.keys.find((key) => key.kid === keyId)) {
      throw new Error('Key not found in jwks');
    }
  }

  private updateConnectState(err?: ErrorWithKeyLike | { message: string }) {
    if (err) {
      this.storage.setPopupTransientState('connect', () => ({
        status: 'error:key',
        error: isErrorWithKey(err) ? errorWithKeyToJSON(err) : err.message,
      }));
    } else {
      this.storage.setPopupTransientState('connect', () => ({
        status: 'connecting:key',
      }));
    }
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
    const scripts = getContentScripts().filter(
      (s) => !existingScriptIds.has(s.id),
    );
    await scripting.registerContentScripts(scripts);
  }
}

function getContentScripts(): Scripting.RegisteredContentScript[] {
  return [
    {
      id: 'keyAutoAdd/testWallet',
      matches: [
        'https://wallet.interledger-test.dev/*',
        'https://wallet.interledger.cards/*',
      ],
      js: ['content/keyAutoAdd/testWallet.js'],
    },
    {
      id: 'keyAutoAdd/fynbos',
      matches: ['https://eu1.fynbos.dev/*', 'https://wallet.fynbos.app/*'],
      js: ['content/keyAutoAdd/fynbos.js'],
    },
    {
      id: 'keyAutoAdd/chimoney',
      matches: ['https://sandbox.chimoney.io/*', 'https://dash.chimoney.io/*'],
      js: ['content/keyAutoAdd/chimoney.js'],
    },
    {
      id: 'keyAutoAdd/gatehub',
      matches: [
        'https://wallet.sandbox.gatehub.net/*',
        'https://signin.sandbox.gatehub.net/*',
        'https://wallet.gatehub.net/*',
        'https://signin.gatehub.net/*',
      ],
      js: ['content/keyAutoAdd/gatehub.js'],
    },
  ];
}

function walletAddressToProvider(walletAddress: WalletAddress): string {
  const { host } = new URL(walletAddress.id);
  switch (host) {
    case 'ilp.interledger-test.dev':
      return 'https://wallet.interledger-test.dev/settings/developer-keys';
    case 'ilp.interledger.cards':
      return 'https://wallet.interledger.cards/settings/developer-keys';
    case 'eu1.fynbos.me':
      return 'https://eu1.fynbos.dev/settings/keys';
    case 'fynbos.me':
      return 'https://wallet.fynbos.app/settings/keys';
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
