import { errorWithKey, ErrorWithKey, sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Run,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForURL } from './lib/helpers';
import {
  gql,
  GraphQlError,
  graphQlRequest,
  walletAddressUrlToId,
} from './lib/helpers/gatehub';
import type { JWK } from '@interledger/open-payments';

// #region: Steps

type GetUserPaymentPointersResponse = {
  me: {
    wallets: {
      ilpPaymentPointers: {
        paymentPointerUrl: string;
      }[];
    }[];
  };
};

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
      throw new ErrorWithKey('connectWalletKeyService_error_timeoutLogin');
    }
    throw new Error(error);
  }

  if (alreadyLoggedIn) {
    skip(errorWithKey('connectWalletKeyService_error_skipAlreadyLoggedIn'));
  }
};

const findWallet: Run<void> = async (
  { walletAddressUrl },
  { setNotificationSize },
) => {
  setNotificationSize('fullscreen');

  const data = await graphQlRequest<GetUserPaymentPointersResponse>({
    operationName: 'GetUserPaymentPointers',
    variables: {
      address: walletAddressUrlToId(walletAddressUrl),
      walletType: 'Hosted',
    },
    query: gql`
      query GetUserPaymentPointers($address: String!, $walletType: WalletType) {
        me {
          wallets(address: $address, walletType: $walletType) {
            ilpPaymentPointers {
              paymentPointerUrl
            }
          }
        }
      }
    `,
  }).catch((error) => {
    if (error instanceof GraphQlError) {
      throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound', [
        error.message,
      ]);
    }
    throw error;
  });

  if (
    !data.me.wallets.some((wallet) => {
      return wallet.ilpPaymentPointers.some(
        ({ paymentPointerUrl }) => paymentPointerUrl === walletAddressUrl,
      );
    })
  ) {
    throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound');
  }
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
