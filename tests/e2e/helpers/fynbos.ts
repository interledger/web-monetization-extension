import type { BrowserContext, Page } from '@playwright/test';
import type { ConnectDetails } from '../pages/popup';
import { waitForWelcomePage } from './common';
import { getWalletInformation } from '@/shared/helpers';

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

export async function getContinueWaitTime(
  context: BrowserContext,
  params: Pick<ConnectDetails, 'walletAddressUrl'>,
) {
  const continueWaitMs = await (async () => {
    const defaultWaitMs = 5001;
    if (process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS !== '1') {
      return Promise.resolve(defaultWaitMs);
    }
    const walletInfo = await getWalletInformation(params.walletAddressUrl);
    return await new Promise<number>((resolve) => {
      const authServer = new URL(walletInfo.authServer).href;
      context.on('requestfinished', async function intercept(req) {
        if (!req.serviceWorker()) return;
        if (new URL(req.url()).href !== authServer) return;

        const res = await req.response();
        if (!res) return;
        const json = await res.json();
        context.off('requestfinished', intercept);
        if (typeof json?.continue?.wait !== 'number') {
          return resolve(defaultWaitMs);
        }
        return resolve(json.continue.wait * 1000);
      });
    });
  })();
  return continueWaitMs;
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
