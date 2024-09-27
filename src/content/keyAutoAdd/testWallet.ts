// cSpell:ignore nextjs
import { sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Step,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForURL } from './lib/helpers';
import { toWalletAddressUrl } from '@/popup/lib/utils';

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

const waitForLogin: Step<never> = async () => {
  const expectedUrl = 'https://rafiki.money/settings/developer-keys';
  try {
    await waitForURL(
      (url) => (url.origin + url.pathname).startsWith(expectedUrl),
      { timeout: LOGIN_WAIT_TIMEOUT },
    );
  } catch (error) {
    if (isTimedOut(error)) {
      throw new Error('Timed out waiting for login');
    }
    throw new Error('Failed to wait for login', { cause: error });
  }
};

const findBuildId: Step<never, { buildId: string }> = async () => {
  await sleep(1000);

  const NEXT_DATA = document.querySelector('script#__NEXT_DATA__')?.textContent;
  if (!NEXT_DATA) {
    throw new Error('Failed to find `_NEXT_DATA_` script');
  }
  try {
    const buildId = JSON.parse(NEXT_DATA).buildId;
    if (!buildId) {
      throw new Error('Failed to parse `_NEXT_DATA_` script');
    }
    return { buildId };
  } catch (error) {
    throw new Error('Failed to parse `_NEXT_DATA_` script', {
      cause: error,
    });
  }
};

const getAccountDetails: Step<typeof findBuildId, Account[]> = async (
  _,
  [{ buildId }],
) => {
  const url = `https://rafiki.money/_next/data/${buildId}/settings/developer-keys.json`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: '*/*',
      'x-nextjs-data': '1',
    },
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
  { keyId },
  [accounts],
) => {
  outer: for (const account of accounts) {
    for (const wallet of account.walletAddresses) {
      for (const key of wallet.keys) {
        if (key.id !== keyId) continue;

        await revokeKey(account.id, wallet.id, key.id);
        break outer;
      }
    }
  }

  return accounts;
};

const findAccountAndWalletId: Step<
  typeof revokeExistingKey,
  { accountId: string; walletId: string }
> = async ({ walletAddressUrl }, [accounts]) => {
  for (const account of accounts) {
    for (const wallet of account.walletAddresses) {
      if (toWalletAddressUrl(wallet.url) === walletAddressUrl) {
        return { accountId: account.id, walletId: wallet.id };
      }
    }
  }
  throw new Error('Failed to find account ID');
};

const addKey: Step<typeof findAccountAndWalletId> = async (
  { publicKey, nickName },
  [{ accountId, walletId }],
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
    throw new Error(`Failed to add key: ${await res.text()}`);
  }
};

new KeyAutoAdd([
  { id: 'Waiting for login', run: waitForLogin },
  { id: 'Finding build ID', run: findBuildId },
  { id: 'Getting account details', run: getAccountDetails },
  { id: 'Revoking existing key', run: revokeExistingKey },
  { id: 'Finding account & wallet ID', run: findAccountAndWalletId },
  { id: 'Adding key', run: addKey },
]).init();

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
