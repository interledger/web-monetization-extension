import type { Page } from '@playwright/test';
import { waitForWelcomePage } from './common';

export const KEYS_PAGE_URL = `https://eu1.fynbos.dev/settings/keys`;
export const LOGIN_PAGE_URL = `https://eu1.fynbos.dev/login?returnTo=%2Fsettings%2Fkeys`;

export async function completeGrant(page: Page, continueWaitMs: number) {
  await waitForGrantConsentPage(page);
  await acceptGrant(page, continueWaitMs);
  await waitForWelcomePage(page);
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

export async function acceptGrant(page: Page, continueWaitMs: number) {
  await page.waitForTimeout(continueWaitMs);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
}

export async function revokeKey(page: Page, origin: string, keyId: string) {
  const baseUrl = `${origin}/settings/keys`;
  await page.goto(`${baseUrl}/${keyId}`);
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.waitForURL(baseUrl, { timeout: 3000 });
}
