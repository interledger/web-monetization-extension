import type { Page } from '@playwright/test';
import {
  getAuthToken,
  getWalletAddressId,
} from '@/content/keyAutoAdd/lib/helpers/chimoney';

export const URLS = {
  login: `${process.env.CHIMONEY_WALLET_ORIGIN}/auth/`,
  keyPage: `${process.env.CHIMONEY_WALLET_ORIGIN}/interledger`,
};

type GetWalletAddressKeysResponse = {
  status: string;
  data: {
    node: {
      id: string;
      jwk: { kid: string };
      revoked: boolean;
      createdAt: string;
    };
  }[];
};

export async function revokeKey(page: Page, jwkKeyId: string) {
  await page.goto(URLS.keyPage);

  // The auth token changes on each page load?!
  const authToken = await page.evaluate(getAuthToken);
  const walletAddressId = await page.evaluate(getWalletAddressId);

  const keyId = await page.evaluate(
    async ({ walletAddressId, authToken, jwkKeyId }) => {
      const url = `/api/interledger/get-user-wallet-address-keys?walletAddressId=${walletAddressId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data: GetWalletAddressKeysResponse = await res.json();

      return data.data.find((e) => e.node.jwk.kid === jwkKeyId)?.node.id;
    },
    { walletAddressId, authToken, jwkKeyId },
  );
  if (!keyId) {
    throw new Error(`Key corresponding to JWK kid="${jwkKeyId}" not found`);
  }

  const revokeInfo = { keyId, authToken };

  return await page.evaluate(async (revokeInfo) => {
    const res = await fetch('/api/interledger/revoke-user-wallet-address-key', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${revokeInfo.authToken}`,
        'content-type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ keyId: revokeInfo.keyId }),
    });
    const data: { status: string } = await res.json();
    return data;
  }, revokeInfo);
}

export async function waitForGrantConsentPage(page: Page) {
  await page.waitForURL((url) => {
    return (
      url.pathname.startsWith('/consent') &&
      url.searchParams.has('interactId') &&
      url.searchParams.has('nonce') &&
      url.searchParams.has('clientUri')
    );
  });
}

export async function login(
  page: Page,
  { username, password }: { username: string; password: string },
) {
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
