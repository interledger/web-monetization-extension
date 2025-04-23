// cSpell:ignore nextjs
import { errorWithKey, ErrorWithKey, sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Run,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForURL } from './lib/helpers';
import { walletAddressUrlToId } from './lib/helpers/gatehub';

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

const findWallet: Run<void> = async (
  { walletAddressUrl },
  { setNotificationSize },
) => {
  setNotificationSize('fullscreen');
  // TODO: this might need different logic for production environment
  const accountAddress = walletAddressUrlToId(walletAddressUrl);

  const res = await fetch('/api/gatehub/wallet', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to get wallet details');
  }
  const accountInfo: { address: string } = await res.json();

  if (accountInfo.address !== accountAddress) {
    throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound');
  }
};

const addKey: Run<void> = async ({ publicKey, nickName }) => {
  const res = await fetch('/api/open-payments/upload-keys', {
    method: 'POST',
    body: JSON.stringify({
      base64Key: publicKey,
      nickname: nickName,
    }),
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
  }).catch((error) => {
    return Response.json(null, { status: 599, statusText: error.message });
  });

  if (!res.ok) {
    throw new Error(`Failed to upload public key (${res.statusText})`);
  }
  const data = await res.json().catch(() => null);
  if (!data?.keyId) {
    // Note: `keyId` is used for revoking keys; it's not same as JWK's `kid`
    throw new Error(`Failed to upload public key (${await res.text()})`);
  }
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
