import { withResolvers } from '@/shared/helpers';
import type { Browser, Runtime, Tabs } from 'webextension-polyfill';
import type { WalletAddress } from '@interledger/open-payments';
import type { Cradle } from '@/background/container';
import type { AddPublicKeyToWalletPayload } from '@/shared/messages';

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

export class KeyShareService {
  private browser: Cradle['browser'];
  private storage: Cradle['storage'];
  private status: null | 'SUCCESS' | 'ERROR' = null;
  private tab: Tabs.Tab | null;

  constructor({ browser, storage }: Cradle) {
    Object.assign(this, { browser, storage });
  }

  async addPublicKeyToWallet({
    walletAddressInfo,
  }: AddPublicKeyToWalletPayload) {
    const { publicKey } = await this.storage.get(['publicKey']);
    if (!publicKey) {
      // won't happen, just added for lint fix
      throw new Error('No public key found');
    }
    const info = walletAddressToProvider(walletAddressInfo);
    try {
      await this.process({
        url: info.url,
        publicKey,
        walletAddressUrl: walletAddressInfo.id,
      });
    } catch (error) {
      if (this.tab?.id) {
        // can redirect to OPEN_PAYMENTS_REDIRECT_URL
        await this.browser.tabs.remove(this.tab.id);
      }
      throw error;
    }
  }

  getTab() {
    return this.tab;
  }

  private async process({
    url,
    walletAddressUrl,
    publicKey,
  }: {
    url: string;
    walletAddressUrl: string;
    publicKey: string;
  }) {
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

    const onMessageListener: OnPortMessageListener = (message: {
      action: string;
      payload: any;
    }) => {
      if (message.action === 'SUCCESS') {
        resolve(message.payload);
      } else if (message.action === 'ERROR') {
        reject(message.payload);
      } else if (message.action === 'PROGRESS') {
        // can save progress to show in popup
      } else {
        reject(new Error(`Unexpected message: ${JSON.stringify(message)}`));
      }
    };

    this.browser.runtime.onConnect.addListener(onConnectListener);

    return promise;
  }
}

export function walletAddressToProvider(walletAddress: WalletAddress): {
  id: string;
  url: string;
} {
  const { host } = new URL(walletAddress.authServer);
  switch (host) {
    // case 'ilp.rafiki.money':
    //   return {
    //     id: 'rafikiMoney',
    //     url: 'https://rafiki.money/settings/developer-keys',
    //   };
    case 'auth.eu1.fynbos.dev':
    default:
      throw new Error('Not implemented for provided wallet yet');
  }
}
