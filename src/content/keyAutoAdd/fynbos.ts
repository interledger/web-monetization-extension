// cSpell:ignore nextjs
import { errorWithKey, ErrorWithKey, sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Run,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForURL } from './lib/helpers';
// #region: Steps

type IndexRouteResponse = {
  isUser: boolean;
  walletInfo: {
    walletID: string;
    url: string;
  };
};

const waitForLogin: Run<void> = async (
  { keyAddUrl },
  { skip, setNotificationSize },
) => {
  let alreadyLoggedIn = window.location.href.startsWith(keyAddUrl);
  if (!alreadyLoggedIn) setNotificationSize('notification');
  try {
    await sleep(2000);
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

const findWallet: Run<void> = async (
  { walletAddressUrl },
  { setNotificationSize },
) => {
  setNotificationSize('fullscreen');
  const url = `/?_data=${encodeURIComponent('routes/_index')}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    credentials: 'include',
  }).catch((error) => {
    return Response.json(null, { status: 599, statusText: error.message });
  });
  if (!res.ok) {
    throw new Error(`Failed to get wallet details (${res.statusText})`);
  }
  const data: IndexRouteResponse = await res.json();
  if (data?.walletInfo?.url !== walletAddressUrl) {
    throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound');
  }
};

const addKey: Run<void> = async ({ nickName, publicKey }) => {
  const url = `/settings/keys/add-public?_data=${encodeURIComponent('routes/settings_.keys_.add-public')}`;
  const csrfToken = await getCSRFToken(url);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    credentials: 'include',
    body: toFormUrlEncoded({
      csrfToken: csrfToken,
      applicationName: nickName,
      publicKey: publicKey,
    }),
  }).catch((error) => {
    return Response.json(null, { status: 599, statusText: error.message });
  });

  if (!res.ok) {
    throw new Error(`Failed to upload public key (${res.statusText})`);
  }
};
// #endregion

// #region: Helpers
const getCSRFToken = async (url: string): Promise<string> => {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    credentials: 'include',
  }).catch((error) => {
    return Response.json(null, { status: 599, statusText: error.message });
  });
  if (!res.ok) {
    throw new Error(`Failed to retrieve CSRF token (${res.statusText})`);
  }

  const { csrfToken }: { csrfToken: string } = await res.json();

  return csrfToken;
};

const toFormUrlEncoded = (data: Record<string, string>) => {
  return Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
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
