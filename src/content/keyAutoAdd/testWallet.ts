// cSpell:ignore nextjs
import { errorWithKey, ErrorWithKey, sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Step,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForURL } from './lib/helpers';
import { toWalletAddressUrl } from '@/popup/lib/utils';

// region: Steps
type Account = {
  id: string;
  walletAddresses: {
    id: string;
    url: string;
    keys: {
      id: string;
    }[];
  }[];
};

type AccountDetails = {
  pageProps: {
    accounts: Account[];
  };
};

const waitForLogin: Step<never> = async ({
  skip,
  setNotificationSize,
  keyAddUrl,
}) => {
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

const getAccountDetails: Step<never, Account[]> = async ({
  setNotificationSize,
}) => {
  setNotificationSize('fullscreen');
  await sleep(1000);

  const NEXT_DATA = document.querySelector('script#__NEXT_DATA__')?.textContent;
  if (!NEXT_DATA) {
    throw new Error('Failed to find `__NEXT_DATA__` script');
  }
  let buildId: string;
  try {
    buildId = JSON.parse(NEXT_DATA).buildId;
    if (!buildId || typeof buildId !== 'string') {
      throw new Error('Failed to get buildId from `__NEXT_DATA__` script');
    }
  } catch (error) {
    throw new Error('Failed to parse `__NEXT_DATA__` script', {
      cause: error,
    });
  }

  const url = `https://rafiki.money/_next/data/${buildId}/settings/developer-keys.json`;
  const res = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
  });
  const json: AccountDetails = await res.json();
  return json.pageProps.accounts;
};

/**
 * The test wallet associates key with an account. If the same key is associated
 * with a different account (user disconnected and changed account), revoke from
 * there first.
 */
const revokeExistingKey: Step<typeof getAccountDetails, Account[]> = async (
  { keyId, skip },
  accounts,
) => {
  for (const account of accounts) {
    for (const wallet of account.walletAddresses) {
      for (const key of wallet.keys) {
        if (key.id === keyId) {
          await revokeKey(account.id, wallet.id, key.id);
          return accounts;
        }
      }
    }
  }

  skip('No existing keys that need to be revoked');
};

const findWallet: Step<
  typeof revokeExistingKey,
  { accountId: string; walletId: string }
> = async ({ walletAddressUrl }, accounts) => {
  for (const account of accounts) {
    for (const wallet of account.walletAddresses) {
      if (toWalletAddressUrl(wallet.url) === walletAddressUrl) {
        return { accountId: account.id, walletId: wallet.id };
      }
    }
  }
  throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound');
};

const addKey: Step<typeof findWallet> = async (
  { publicKey, nickName },
  { accountId, walletId },
) => {
  const url = `https://api.rafiki.money/accounts/${accountId}/wallet-addresses/${walletId}/upload-key`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      base64Key: publicKey,
      nickname: nickName,
    }),
    mode: 'cors',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
};
// endregion

// region: Helpers
async function revokeKey(accountId: string, walletId: string, keyId: string) {
  const url = `https://api.rafiki.money/accounts/${accountId}/wallet-addresses/${walletId}/${keyId}/revoke-key/`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    mode: 'cors',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to revoke key: ${await res.text()}`);
  }
}
// endregion

// region: Main
new KeyAutoAdd([
  {
    name: 'Waiting for you to login',
    run: waitForLogin,
    maxDuration: LOGIN_WAIT_TIMEOUT,
  },
  { name: 'Getting account details', run: getAccountDetails },
  { name: 'Revoking existing key', run: revokeExistingKey },
  { name: 'Finding wallet', run: findWallet },
  { name: 'Adding key', run: addKey },
]).init();
// endregion
