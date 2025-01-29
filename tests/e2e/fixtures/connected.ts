import { type test as base, expect as baseExpect } from './base';
import {
  connectWallet,
  disconnectWallet,
  type ConnectDetails,
} from '../pages/popup';
import { DEFAULT_KEY_INFO } from '../helpers/testWallet';
import { resetExtensionStorage } from './helpers';

/**
 * Playwright runs `beforeAll` once at the end of each worker, for all test
 * files. There's no `beforeAllTestsInFile`, which is what we need here. So we
 * work around it by adding a "fake" test after all tests, which acts as
 * beforeAll tests in file for us.
 *
 * @example Add following at the star of test file
 * ``` ts
 * test(...beforeAllConnectWallet());
 * // or
 * test(...beforeAllConnectWallet(optionalConnectDetails, optionalKeyInfo));
 * ```
 *
 * @see https://github.com/microsoft/playwright/issues/34519
 *
 * @param keyInfo is needed if using a non-default {@linkcode walletAddressUrl}
 */
export const beforeAllConnectWallet = (
  {
    walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL,
    amount = '10',
    recurring = false,
  }: Partial<ConnectDetails> = {},
  keyInfo = DEFAULT_KEY_INFO,
): Parameters<typeof base> => {
  return [
    'beforeAll @hook - connectWallet',
    {},
    async ({ persistentContext, background, popup, i18n }) => {
      await baseExpect(background).not.toHaveStorage({ connected: true });
      await connectWallet(persistentContext, background, i18n, keyInfo, popup, {
        walletAddressUrl,
        amount,
        recurring,
      });
      await baseExpect(background).toHaveStorage({ connected: true });
    },
  ];
};

/**
 * Playwright runs `afterAll` once at the end of each worker, for all test
 * files. There's no `afterAllTestsInFile`, which is what we need here. So we
 * work around it by adding a "fake" test after all tests, which acts as
 * afterAll tests in file for us.
 *
 * @example Add following at the end of test file
 * ``` ts
 * test(...afterAllDisconnectWallet());
 * ```
 *
 * @see https://github.com/microsoft/playwright/issues/34519
 */
export const afterAllDisconnectWallet = (): Parameters<typeof base> => {
  return [
    'afterAll @hook - disconnectWallet',
    {},
    async ({ popup, background }) => {
      await baseExpect(background).toHaveStorage({ connected: true });
      await disconnectWallet(popup);
      await baseExpect(background).not.toHaveStorage({ connected: true });
      await resetExtensionStorage(background);
    },
  ];
};

/**
 * Playwright runs `afterAll` once at the end of each worker, for all test
 * files. There's no `afterAllTestsInFile`, which is what we need here. So we
 * work around it by adding a "fake" test after all tests, which acts as
 * afterAll tests in file for us.
 *
 * This helper is alternative to {@linkcode afterAllDisconnectWallet} when test
 * is using custom connect process.
 *
 * @example Add following at the end of test file
 * ``` ts
 * test(...afterAllResetExtensionStorage());
 * ```
 *
 * @see https://github.com/microsoft/playwright/issues/34519
 */
export const afterAllResetExtensionStorage = (): Parameters<typeof base> => {
  return [
    'afterAll @hook - resetExtensionStorage',
    {},
    async ({ background }) => {
      await resetExtensionStorage(background);
    },
  ];
};

// With extension connected to the wallet.
// export const test = base.extend({
//   // We want a forEachFile here
//   // https://github.com/microsoft/playwright/issues/34519
//   forEachTest: [
//     async ({ persistentContext: context, background, popup, i18n }, use) => {
//       const keyInfo = {
//         keyId: process.env.TEST_WALLET_KEY_ID,
//         privateKey: process.env.TEST_WALLET_PRIVATE_KEY,
//         publicKey: process.env.TEST_WALLET_PUBLIC_KEY,
//       };
//       await connectWallet(context, background, i18n, keyInfo, popup, {
//         walletAddressUrl: process.env.TEST_WALLET_ADDRESS_URL,
//         amount: '10',
//         recurring: false,
//       });
//       await popup.reload({ waitUntil: 'networkidle' });

//       await use(undefined);

//       await disconnectWallet(popup);
//       await background.evaluate(() => chrome.storage.local.clear());
//     },
//     { box: true, timeout: 20_000 },
//   ],
// });

// export const expect = mergeExpects(baseExpect, test.expect);
