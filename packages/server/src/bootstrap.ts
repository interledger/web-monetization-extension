import { createAuthenticatedClient } from '@interledger/open-payments';

import { Application } from './app';
import { config } from './config';

async function test() {
  console.log('creating op client');
  return await createAuthenticatedClient({
    walletAddressUrl: config.WALLET_ADDRESS,
    privateKey: Buffer.from(config.PRIVATE_KEY, 'base64'),
    keyId: config.KEY_ID,
  });
}

export async function bootstrap() {
  const client = await test();

  const app = new Application(config, client);
  await app.start();
  console.log(`WM Server listening on port ${config.PORT}`);
}
