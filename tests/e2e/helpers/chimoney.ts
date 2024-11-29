import type { Page } from '@playwright/test';

export const URLS = {
  get login() {
    return `${process.env.CHIMONEY_WALLET_URL}/auth/signin`;
  },
  get keyPage() {
    return `${process.env.CHIMONEY_WALLET_URL}/interledger`;
  },
};

export const DEFAULT_CONTINUE_WAIT_MS = 1000;

export async function revokeKey(
  page: Page,
  revokeInfo: { keyId: string; authorizationHeader: string },
) {
  await page.goto(URLS.keyPage);
  return await page.evaluate(async (revokeInfo) => {
    const res = await fetch('/api/interledger/revoke-user-wallet-address-key', {
      method: 'POST',
      headers: {
        authorization: revokeInfo.authorizationHeader,
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
