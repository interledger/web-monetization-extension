import type { Browser, Runtime, Tabs } from 'webextension-polyfill';
import type { WalletAddress } from '@interledger/open-payments';
import type { TabId } from '@/shared/types';
import type { Cradle } from '@/background/container';
import type { ContentToBackgroundMessage } from '@/content/keyAutoAdd/lib/types';
import { ErrorWithKey, withResolvers } from '@/shared/helpers';

export const CONNECTION_NAME = 'key-share';

type OnTabRemovedCallback = Parameters<
  Browser['tabs']['onRemoved']['addListener']
>[0];
type OnConnectCallback = Parameters<
  Browser['runtime']['onConnect']['addListener']
>[0];
type OnPortMessageListener = Parameters<
  Runtime.Port['onMessage']['addListener']
>[0];

type BeginPayload = { walletAddressUrl: string; publicKey: string };

export class KeyShareService {
  private browser: Cradle['browser'];
  private storage: Cradle['storage'];

  private status: null | 'SUCCESS' | 'ERROR' = null;
  private tab: Tabs.Tab | null = null;

  constructor({ browser, storage }: Pick<Cradle, 'browser' | 'storage'>) {
    Object.assign(this, { browser, storage });
  }

  async addPublicKeyToWallet(walletAddress: WalletAddress) {
    const info = walletAddressToProvider(walletAddress);
    try {
      const { publicKey } = await this.storage.get(['publicKey']);
      this.setConnectState('adding-key');
      await this.process(info.url, {
        publicKey,
        walletAddressUrl: walletAddress.id,
      });
    } catch (error) {
      this.setConnectState('error-key');
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
    { walletAddressUrl, publicKey }: BeginPayload,
  ) {
    const { resolve, reject, promise } = withResolvers();

    const tab = await this.browser.tabs.create({ url });
    this.tab = tab;
    if (!tab.id) {
      reject(new Error('Could not create tab'));
      return promise;
    }

    const onTabCloseListener: OnTabRemovedCallback = (tabId) => {
      if (tabId !== tab.id) {
        // ignore. not our tab
        return;
      }

      if (this.status === 'SUCCESS') {
        // ok
      } else {
        reject(new Error('Tab closed before completion'));
      }
    };
    this.browser.tabs.onRemoved.addListener(onTabCloseListener);

    const onConnectListener: OnConnectCallback = (port) => {
      if (port.name !== CONNECTION_NAME) return;
      if (port.error) {
        reject(new Error(port.error.message));
        return;
      }

      port.postMessage({
        action: 'BEGIN',
        payload: { walletAddressUrl, publicKey },
      });

      port.onMessage.addListener(onMessageListener);

      port.onDisconnect.addListener(() => {
        // wait for connect again so we can send message again if not connected,
        // and not errored already (e.g. page refreshed)
      });
    };

    const onMessageListener: OnPortMessageListener = (
      message: ContentToBackgroundMessage,
    ) => {
      if (message.action === 'SUCCESS') {
        resolve(message.payload);
      } else if (message.action === 'ERROR') {
        reject(
          new ErrorWithKey('connectWalletKeyService_error_failed', [
            message.payload.stepId,
            message.payload.error.message,
          ]),
        );
      } else if (message.action === 'PROGRESS') {
        console.log(message);
        // can save progress to show in popup
      } else {
        reject(new Error(`Unexpected message: ${JSON.stringify(message)}`));
      }
    };

    this.browser.runtime.onConnect.addListener(onConnectListener);

    return promise;
  }

  private setConnectState(status: 'adding-key' | 'error-key' | null) {
    const state = status ? { status } : null;
    this.storage.setPopupTransientState('connect', () => state);
  }
}

export function walletAddressToProvider(walletAddress: WalletAddress): {
  url: string;
} {
  const { host } = new URL(walletAddress.id);
  switch (host) {
    case 'ilp.rafiki.money':
      return {
        url: 'https://rafiki.money/settings/developer-keys',
      };
    // case 'eu1.fynbos.me': // fynbos dev
    // case 'fynbos.me': // fynbos production
    default:
      throw new ErrorWithKey('connectWalletKeyService_error_notImplemented');
  }
}
