// cSpell:ignore nextjs
import { errorWithKey, ErrorWithKey, sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Run,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForURL } from './lib/helpers';

// #region: Steps

const waitForLogin: Run<void> = async (
  { keyAddUrl },
  { skip, setNotificationSize },
) => {
  await sleep(2000);
  let alreadyLoggedIn = window.location.href.startsWith(keyAddUrl);
  if (!alreadyLoggedIn) setNotificationSize('notification');
  try {
    alreadyLoggedIn = await waitForURL(
      (url) => (url.origin + url.pathname).startsWith(keyAddUrl),
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

// TODO
const findWallet: Run<{ walletAddressId: string }> = async (
  { walletAddressUrl },
  { setNotificationSize },
) => {
  setNotificationSize('fullscreen');
  const url = `/`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    credentials: 'include',
  }).catch((error) => {
    return Response.json(null, { status: 599, statusText: error.message });
  });
  if (!res.ok) {
    throw new Error(`Failed to get wallet details (${res.statusText})`);
  }
  const data = await res.json();
  if (data?.walletInfo?.url !== walletAddressUrl) {
    throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound');
  }

  return { walletAddressId: '' };
};

const addKey: Run<void> = async ({ publicKey }, { output }) => {
  const { walletAddressId } = output(findWallet);

  const res = await fetch('/api/interledger/create-user-wallet-address-key', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${getAuthToken()}`,
      'content-type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      key: publicKey,
      walletAddressId,
      // Chimoney doesn't have a nickName field supported yet
    }),
  }).catch((error) => {
    return Response.json(null, { status: 599, statusText: error.message });
  });

  if (!res.ok) {
    throw new Error(`Failed to upload public key (${res.statusText})`);
  }
  const data = await res.json().catch(() => null);
  if (data?.status !== 'success') {
    throw new Error(`Failed to upload public key (${await res.text()})`);
  }
};
// #endregion

// #region: Helpers
const getAuthToken = (): string => {
  const getFirebaseAuthKey = () => {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('firebase:authUser:')) {
        return key;
      }
    }
  };

  const key = getFirebaseAuthKey();
  if (!key) {
    throw new Error('No Firebase auth key found');
  }
  const firebaseDataStr = sessionStorage.getItem(key);
  if (!firebaseDataStr) {
    throw new Error('No Firebase auth data found');
  }
  const firebaseData: {
    stsTokenManager: {
      accessToken: string;
      refreshToken: string;
      expirationTime: number;
    };
  } = JSON.parse(firebaseDataStr);
  const token = firebaseData?.stsTokenManager?.accessToken;
  if (!token) {
    throw new Error('No Firebase auth token found');
  }
  const JWT_REGEX =
    /^([A-Za-z0-9-_=]{2,})\.([A-Za-z0-9-_=]{2,})\.([A-Za-z0-9-_=]{2,})$/;
  if (JWT_REGEX.test(token)) {
    throw new Error('Invalid Firebase auth token');
  }
  return token;
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
