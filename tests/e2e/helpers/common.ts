import type { BrowserContext, Page } from '@playwright/test';
import type {
  WalletAddress,
  IncomingPayment,
  OutgoingPayment,
} from '@interledger/open-payments';
import type { ConnectDetails } from '../pages/popup';
import { spy, type SpyFn } from 'tinyspy';
import { getWalletInformation, withResolvers } from '@/shared/helpers';
import { NEW_TAB_PAGES } from '@/background/constants';

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

/**
 * Some times, we open a new tab then update its URL.
 * Other times, we open tab with URL already set.
 * This handles both the scenarios.
 */
export async function waitForPage(
  context: BrowserContext,
  isTargetPage: (url: string) => boolean,
): Promise<Page> {
  const { promise, resolve, reject } = withResolvers<Page>();
  const timeoutSignal = AbortSignal.timeout(10 * 1000);
  timeoutSignal.addEventListener('abort', () => {
    reject(new Error('Timeout waiting for page'));
  });
  const pages = context.pages();
  const existingPage = pages.find((page) => isTargetPage(page.url()));
  if (existingPage) {
    resolve(existingPage);
    return promise;
  }
  const existingNewTabPage = pages.find((page, i) =>
    NEW_TAB_PAGES.some((p) => i !== 0 && page.url().startsWith(p)),
  );
  if (existingNewTabPage) {
    await existingNewTabPage.waitForURL((url) => isTargetPage(url.href));
    resolve(existingNewTabPage);
    return promise;
  }
  context.on('page', async function onPage(page) {
    const url = page.url();
    if (isTargetPage(url)) {
      context.off('page', onPage);
      resolve(page);
    } else if (NEW_TAB_PAGES.some((p) => url.startsWith(p))) {
      await page.waitForURL((url) => isTargetPage(url.href));
      context.off('page', onPage);
      resolve(page);
    }
  });
  return promise;
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
    const walletInfo = await getWalletInfoCached(params.walletAddressUrl);
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

const walletInfoCache = new Map<string, Promise<WalletAddress>>();
export function getWalletInfoCached(walletAddressUrl: string) {
  if (walletInfoCache.has(walletAddressUrl)) {
    return walletInfoCache.get(walletAddressUrl)!;
  }
  const walletInfoPromise = getWalletInformation(walletAddressUrl);
  walletInfoCache.set(walletAddressUrl, walletInfoPromise);
  return walletInfoPromise;
}

export async function setupPlayground(
  page: Page,
  ...walletAddressUrls: string[]
) {
  const monetizationCallback = spy<[window.MonetizationEvent], void>();
  await page.exposeFunction('monetizationCallback', monetizationCallback);
  await page.addInitScript({
    content: `window.addEventListener('monetization', monetizationCallback)`,
  });
  await page.goto(playgroundUrl(...walletAddressUrls));
  return monetizationCallback;
}

export function getLastCallArg<T>(fn: SpyFn<[T]>) {
  // we only deal with single arg functions
  return fn.calls[fn.calls.length - 1][0];
}

/**
 * Intercept following requests:
 * - https://openpayments.dev/apis/resource-server/operations/create-incoming-payment/
 * - https://openpayments.dev/apis/resource-server/operations/create-outgoing-payment/
 */
export function interceptPaymentCreateRequests(context: BrowserContext) {
  const outgoingPaymentCreatedCallback = spy<[OutgoingPayment], void>();
  const incomingPaymentCreatedCallback = spy<[IncomingPayment], void>();

  context.on('requestfinished', async (req) => {
    if (!req.serviceWorker()) return;
    if (req.method() !== 'POST') return;

    const isIncomingPayment = req.url().endsWith('/incoming-payments');
    const isOutgoingPayment = req.url().endsWith('/outgoing-payments');

    if (!isIncomingPayment && !isOutgoingPayment) {
      return;
    }

    const res = await req.response();
    if (!res) {
      throw new Error(`no response from POST ${req.url()}`);
    }

    if (isIncomingPayment) {
      const incomingPayment: IncomingPayment = await res.json();
      incomingPaymentCreatedCallback(incomingPayment);
      return;
    }

    const outgoingPayment: OutgoingPayment = await res.json();
    outgoingPaymentCreatedCallback(outgoingPayment);
  });

  return {
    outgoingPaymentCreatedCallback,
    incomingPaymentCreatedCallback,
  };
}
