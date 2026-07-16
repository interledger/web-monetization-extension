import { errorWithKey, ErrorWithKey, sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Run,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForURL } from './lib/helpers';
import {
  getUserWallets,
  getUserPaymentPointers,
  gql,
  GraphQlError,
  graphQlRequest,
} from './lib/helpers/gatehub';
import type { JWK } from '@interledger/open-payments';

// #region: Steps

type AddILPWalletAddressKeyResponse = {
  addILPWalletAddressKey: {
    id: string; // not same as `kid`. use this to revoke
    createdAt: string;
    jwk: JWK;
    name: string;
  };
};

const waitForLogin: Run<void> = async (
  { keyAddUrl },
  { skip, setNotificationSize },
) => {
  await sleep(1000);
  let alreadyLoggedIn = window.location.href.startsWith(keyAddUrl);
  if (!alreadyLoggedIn) setNotificationSize('notification');
  try {
    alreadyLoggedIn = await waitForURL(
      (url) => (url.origin + url.pathname + url.hash).startsWith(keyAddUrl),
      { timeout: LOGIN_WAIT_TIMEOUT },
    );
    setNotificationSize('fullscreen');
  } catch (error) {
    if (isTimedOut(error)) {
      throw new ErrorWithKey('connectWalletKeyService_timeoutLogin_error');
    }
    throw new Error(error);
  }

  if (alreadyLoggedIn) {
    skip(errorWithKey('connectWalletKeyService_skipAlreadyLoggedIn_error'));
  }
};

const findWallet: Run<void> = async (
  { walletAddressUrl },
  { setNotificationSize },
) => {
  setNotificationSize('fullscreen');
  const wallets = await getUserWallets();
  if (!wallets.length) {
    throw new ErrorWithKey('connectWalletKeyService_accountNotFound_error', [
      'No active wallet found',
    ]);
  }

  for (const wallet of wallets) {
    const data = await getUserPaymentPointers(wallet);
    const walletBelongsToUser = data.wallets.some((wallet) => {
      return wallet.ilpPaymentPointers.some(
        ({ paymentPointerUrl }) =>
          paymentPointerUrl.toLowerCase() === walletAddressUrl.toLowerCase(),
      );
    });
    if (walletBelongsToUser) return; // ok
  }

  throw new ErrorWithKey('connectWalletKeyService_accountNotFound_error');
};

const addKey: Run<void> = async ({ nickName, walletAddressUrl, publicKey }) => {
  await graphQlRequest<AddILPWalletAddressKeyResponse>({
    operationName: 'AddILPWalletAddressKey',
    variables: {
      input: {
        name: nickName,
        paymentPointerUrl: walletAddressUrl,
        jwkBase64: publicKey,
      },
    },
    query: gql`
      mutation AddILPWalletAddressKey(
        $input: AddILPWalletAddressKeyBase64Input!
      ) {
        addILPWalletAddressKeyBase64(input: $input) {
          id
          createdAt
          jwk {
            kid
          }
          name
        }
      }
    `,
  }).catch((error) => {
    if (error instanceof GraphQlError) {
      throw new Error(error.message);
    }
    throw new Error(`Failed to upload public key (${error.message})`);
  });
};
// #endregion

// #region: Main
new KeyAutoAdd([
  {
    name: 'Waiting for you to login',
    run: waitForLogin,
    maxDuration: LOGIN_WAIT_TIMEOUT,
  },
  { name: 'Finding wallet', run: findWallet },
  { name: 'Adding key', run: addKey },
]).init();
// #endregion
