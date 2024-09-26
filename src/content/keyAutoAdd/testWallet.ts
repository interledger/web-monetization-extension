// cSpell:ignore nextjs
import { sleep } from '@/shared/helpers';
import { KeyAutoAdd, type StepRun } from './lib/keyAutoAdd';
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

const stepFindBuildId: StepRun<never, { buildId: string }> = async () => {
  if (!location.pathname.startsWith('/settings/developer-keys')) {
    throw new Error('Not on keys page. Are you not logged in?');
  }
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

const stepGetAccountDetails: StepRun<
  typeof stepFindBuildId,
  Account[]
> = async (_, [{ buildId }]) => {
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

const findAccountAndWalletId: StepRun<
  typeof stepGetAccountDetails,
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

const addKey: StepRun<typeof findAccountAndWalletId> = async (
  { publicKey },
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
      nickname: 'web monetization extension',
    }),
    mode: 'cors',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to add key: ${await res.text()}`);
  }
};

new KeyAutoAdd([
  {
    id: 'Find build ID',
    run: stepFindBuildId,
  },
  {
    id: 'Get account details',
    run: stepGetAccountDetails,
  },
  {
    id: 'Find account & wallet ID',
    run: findAccountAndWalletId,
  },
  {
    id: 'Add key',
    run: addKey,
  },
]).init();
