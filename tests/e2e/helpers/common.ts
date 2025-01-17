import type { BrowserContext, Page } from '@playwright/test';
import type { ConnectDetails } from '../pages/popup';
import { spy } from 'tinyspy';
import { getWalletInformation } from '@/shared/helpers';

const OPEN_PAYMENTS_REDIRECT_URL = 'https://webmonetization.org/welcome';
const PLAYGROUND_URL = 'https://webmonetization.org/play';

export async function waitForWelcomePage(page: Page) {
  await page.waitForURL(
    (url) =>
      url.href.startsWith(OPEN_PAYMENTS_REDIRECT_URL) &&
      url.searchParams.get('result') === 'grant_success',
  );
}

export async function waitForReconnectWelcomePage(page: Page) {
  await page.waitForURL(
    (url) =>
      url.href.startsWith(OPEN_PAYMENTS_REDIRECT_URL) &&
      url.searchParams.get('result') === 'key_add_success',
  );
}

export async function getContinueWaitTime(
  context: BrowserContext,
  params: Pick<ConnectDetails, 'walletAddressUrl'>,
  // https://github.com/interledger/rafiki/blob/5de6208fad4c73fba81db56bd7174609e5f76ed5/packages/auth/src/config/app.ts#L62
  defaultWaitMs = 5000,
) {
  const continueWaitMs = await (async () => {
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
        const json = await res?.json();
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

export function playgroundUrl(...walletAddressUrls: string[]) {
  const url = new URL(PLAYGROUND_URL);
  for (const walletAddress of walletAddressUrls) {
    url.searchParams.append('wa', walletAddress);
  }
  return url.href;
}

export async function setupPlayground(
  page: Page,
  ...walletAddressUrls: string[]
) {
  const monetizationCallback = spy<[window.MonetizationEvent], void>();
  await page.exposeFunction('monetizationCallback', monetizationCallback);
  await page.goto(playgroundUrl(...walletAddressUrls));
  await page.evaluate(() => {
    window.addEventListener('monetization', monetizationCallback);
  });
  return monetizationCallback;
}
