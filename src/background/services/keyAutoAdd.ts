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
import type { TabId } from '@/shared/types';
import type { Cradle } from '@/background/container';
import type {
  BeginPayload,
  KeyAutoAddToBackgroundMessage,
} from '@/content/keyAutoAdd/lib/types';

export const CONNECTION_NAME = 'key-auto-add';

type OnTabRemovedCallback = Parameters<
  Browser['tabs']['onRemoved']['addListener']
>[0];
type OnTabUpdatedCallback = Parameters<
  Browser['tabs']['onUpdated']['addListener']
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
    existingTabId: TabId,
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

  private async process(
    url: string,
    payload: BeginPayload,
    existingTabId: TabId,
  ): Promise<unknown> {
    const { resolve, reject, promise } = withResolvers();
    await this.browser.tabs.update(existingTabId, { url });

    const removeListeners = () => {
      this.browser.tabs.onRemoved.removeListener(onTabCloseListener);
      this.browser.tabs.onUpdated.removeListener(onTabUpdatedListener);
      this.browser.runtime.onConnect.removeListener(onConnectListener);
    };

    const onTabUpdatedListener: OnTabUpdatedCallback = (tabId, _, tab) => {
      if (tabId !== existingTabId) return;
      const tabUrl = tab.url || '';
      if (!isAllowedURL(tabUrl, url)) {
        removeListeners();
        reject(new ErrorWithKey('connectWallet_error_tabNavigatedAway'));
      }
    };

    const onTabCloseListener: OnTabRemovedCallback = (tabId) => {
      if (tabId !== existingTabId) return;
      removeListeners();
      reject(new ErrorWithKey('connectWallet_error_tabClosed'));
    };

    const ports = new Set<Runtime.Port>();
    const onConnectListener: OnConnectCallback = (port) => {
      if (port.name !== CONNECTION_NAME) return;
      if (port.sender?.tab && port.sender.tab.id !== existingTabId) return;
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
        // can also save progress to show in popup
        for (const p of ports) {
          if (p !== port) p.postMessage(message);
        }
      } else {
        reject(new Error(`Unexpected message: ${JSON.stringify(message)}`));
      }
    };

    this.browser.tabs.onUpdated.addListener(onTabUpdatedListener);
    this.browser.tabs.onRemoved.addListener(onTabCloseListener);
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
    matches: ['https://eu1.fynbos.dev/*'],
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
// assumption: matches patterns are URL parse-able! Will crash on load if not.
const CONTENT_SCRIPTS_HOSTS = CONTENT_SCRIPTS.map((script) =>
  script.matches!.map((e) => new URL(e).host),
);

/**
 * Is user allowed to be on this URL during key add process? If not, we should
 * abort as user went to some other URL in the tab meant for key-add and lost
 * their way.
 */
function isAllowedURL(
  url: string,
  keyAddUrl: string,
  allHosts = CONTENT_SCRIPTS_HOSTS,
): boolean {
  const { host: provider } = new URL(keyAddUrl);
  const { host: urlHost } = new URL(url);
  return (
    allHosts
      .find((hosts) => hosts.some((host) => host.includes(provider)))
      ?.some((host) => host === urlHost) ?? false
  );
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
    case 'pay.interledger.app':
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
