import type { Page } from '@playwright/test';

export const URLS = {
  login: `${process.env.MMAON_WALLET_ORIGIN}/auth/login`,
  get loginFull() {
    const url = new URL('/auth/login', process.env.MMAON_WALLET_ORIGIN!);
    url.searchParams.set('callbackUrl', this.keyPage);
    return url.href;
  },
  keyPage: `${process.env.MMAON_WALLET_ORIGIN}/wallet/dashboard`,
};

export async function revokeKey(page: Page, revokeInfo: { keyId: string }) {
  await page.goto(URLS.keyPage);

  return await page.evaluate(async (revokeInfo) => {
    const res = await fetch('/api/open-payments/revoke-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ keyId: revokeInfo.keyId }),
    });
    const data: any = await res.json();
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
