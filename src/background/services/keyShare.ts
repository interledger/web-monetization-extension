import type { WalletAddress } from '@interledger/open-payments';
import type { Cradle } from '@/background/container';

export const CONNECTION_NAME = 'key-share';

export class KeyShareService {
  // eslint-disable-next-line no-unused-vars
  private browser: Cradle['browser'];
  // eslint-disable-next-line no-unused-vars
  private storage: Cradle['storage'];

  constructor({ browser, storage }: Pick<Cradle, 'browser' | 'storage'>) {
    Object.assign(this, { browser, storage });
  }

  async addPublicKeyToWallet(_walletAddress: WalletAddress) {
    throw new Error('Not implemented for provided wallet yet');
  }
}
