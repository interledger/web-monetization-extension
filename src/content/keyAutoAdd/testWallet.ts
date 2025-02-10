// cSpell:ignore nextjs
import { errorWithKey, ErrorWithKey, sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Run,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForURL } from './lib/helpers';
import { toWalletAddressUrl } from '@/pages/shared/lib/utils';

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

const IS_INTERLEDGER_CARDS = location.host === 'wallet.interledger.cards';

const API_ORIGIN = IS_INTERLEDGER_CARDS
  ? 'https://api.interledger.cards'
  : `https://api.${location.host}`;

const waitForLogin: Run<void> = async (
  { keyAddUrl },
  { skip, setNotificationSize },
) => {
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

const getAccounts: Run<Account[]> = async (_, { setNotificationSize }) => {
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

  const url = `/_next/data/${buildId}/settings/developer-keys.json`;
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
 *
 * Why? Say, user connected once to `USD -> Addr#1`. Then disconnected. The key
 * is still there in wallet added to `USD -> Addr#1` account. If now user wants
 * to connect `EUR -> Addr#2` account, the extension still has the same key. So
 * adding it again will throw an `internal server error`. But we'll continue
 * getting `invalid_client` if we try to connect without the key added to new
 * address. That's why we first revoke existing key (by ID) if any (from any
 * existing account/address). It's a test-wallet specific thing.
 */
const revokeExistingKey: Run<void> = async ({ keyId }, { skip, output }) => {
  const accounts = output(getAccounts);
  for (const account of accounts) {
    for (const wallet of account.walletAddresses) {
      for (const key of wallet.keys) {
        if (key.id === keyId) {
          await revokeKey(account.id, wallet.id, key.id);
        }
      }
    }
  }

  skip('No existing keys that need to be revoked');
};

const findWallet: Run<{ accountId: string; walletId: string }> = async (
  { walletAddressUrl },
  { output },
) => {
  const accounts = output(getAccounts);
  for (const account of accounts) {
    for (const wallet of account.walletAddresses) {
      if (walletAddressUrl === normalizeWalletAddress(wallet.url)) {
        return { accountId: account.id, walletId: wallet.id };
      }
    }
  }
  throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound');
};

const addKey: Run<void> = async ({ publicKey, nickName }, { output }) => {
  const { accountId, walletId } = output(findWallet);
  const url = `${API_ORIGIN}/accounts/${accountId}/wallet-addresses/${walletId}/upload-key`;
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
  const url = `${API_ORIGIN}/accounts/${accountId}/wallet-addresses/${walletId}/${keyId}/revoke-key/`;
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

function normalizeWalletAddress(urlOrPaymentPointer: string) {
  const url = new URL(toWalletAddressUrl(urlOrPaymentPointer));
  if (IS_INTERLEDGER_CARDS && url.host === 'ilp.dev') {
    // For Interledger Cards we can have two types of wallet addresses:
    //  - ilp.interledger.cards
    //  - ilp.dev (just a proxy behind ilp.interledger.cards for certain wallet addresses)
    //
    // `ilp.dev` wallet addresses are only used for wallet addresses that are
    // linked to a card.
    //
    // `ilp.interledger.cards` used for the other wallet addresses (user created)
    //
    // Not all `ilp.interledger.cards` wallet addresses can be used with `ilp.dev`.
    // Manually created wallet addresses cannot be used with `ilp.dev`.
    return url.href.replace('ilp.dev', 'ilp.interledger.cards');
  }
  return url.href;
}
// endregion

// region: Main
new KeyAutoAdd([
  {
    name: 'Waiting for you to login',
    run: waitForLogin,
    maxDuration: LOGIN_WAIT_TIMEOUT,
  },
  { name: 'Getting account details', run: getAccounts },
  { name: 'Revoking existing key', run: revokeExistingKey },
  { name: 'Finding wallet', run: findWallet },
  { name: 'Adding key', run: addKey },
]).init();
// endregion
