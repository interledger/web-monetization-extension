import { test, expect } from './fixtures/base';
import { ensureEnd, withResolvers } from '@/shared/helpers';
import { disconnectWallet, fillPopup } from './pages/popup';
import {
  acceptGrant,
  KEYS_PAGE_URL,
  getContinueWaitTime,
  revokeKey,
  waitForGrantConsentPage,
} from './helpers/testWallet';
import { getJWKS, waitForWelcomePage } from './helpers/common';

test('Connect to test wallet with automatic key addition when not logged-in to wallet', async ({
  page,
  popup,
  persistentContext: context,
  background,
  i18n,
}) => {
  const username = process.env.WALLET_USERNAME!;
  const password = process.env.WALLET_PASSWORD!;
  const walletAddressUrl = process.env.CONNECT_WALLET_ADDRESS_URL!;

  const jwksUrl = new URL('jwks.json', ensureEnd(walletAddressUrl, '/')).href;

  const loginPageUrl = `https://rafiki.money/auth/login?callbackUrl=%2Fsettings%2Fdeveloper-keys`;

  const connectButton = await test.step('fill popup', async () => {
    const connectButton = await fillPopup(popup, i18n, {
      walletAddressUrl,
      amount: '10',
      recurring: false,
    });
    return connectButton;
  });

  await test.step('ensure not logged in', async () => {
    await context.clearCookies();

    await page.goto(KEYS_PAGE_URL);
    expect(page.url()).toBe(loginPageUrl);
    await page.close();
  });

  await test.step('asks for key-add consent', async () => {
    await connectButton.click();
    await popup.waitForSelector(
      `[data-testid="connect-wallet-auto-key-consent"]`,
    );

    expect(popup.getByTestId('connect-wallet-auto-key-consent')).toBeVisible();
    await popup
      .getByRole('button', {
        name: i18n.getMessage('connectWalletKeyService_label_consentAccept'),
      })
      .click();
  });

  page = await test.step('shows login page', async () => {
    const openedPage = await context.waitForEvent('page', {
      predicate: (page) => page.url().startsWith(loginPageUrl),
      timeout: 3 * 1000,
    });
    await openedPage.getByLabel('E-mail').fill(username);
    await openedPage.getByLabel('Password').fill(password);
    await openedPage.getByRole('button', { name: 'login' }).click();
    await openedPage.waitForURL(KEYS_PAGE_URL);
    await expect(openedPage.locator('h1')).toHaveText('Developer Keys');

    return openedPage;
  });

  const continueWaitMsPromise = getContinueWaitTime(context, {
    walletAddressUrl,
  });

  const revokeInfo = await test.step('adds key to wallet', async () => {
    const { resolve, reject, promise } = withResolvers<{
      accountId: string;
      walletId: string;
    }>();
    const pause = withResolvers<void>();
    page.on('requestfinished', async function intercept(req) {
      if (req.serviceWorker()) return;
      if (req.method() !== 'POST') return;
      const url = new URL(req.url());
      if (url.origin !== 'https://api.rafiki.money') return;
      if (!url.pathname.startsWith('/accounts/')) return;
      if (!url.pathname.includes('/upload-key')) return;

      const pattern =
        /^\/accounts\/(?<accountId>.+)\/wallet-addresses\/(?<walletId>.+)\/upload-key$/;
      const match = url.pathname.match(pattern);
      if (!match) {
        throw new Error('no match for URL pattern');
      }
      const result = match.groups as { accountId: string; walletId: string };

      const res = await req.response();
      page.off('requestfinished', intercept);
      if (!res) {
        reject('no response from /upload-key API');
      } else {
        await pause.promise;
        resolve(result);
      }
    });

    const { keyId } = await background.evaluate(() => {
      return chrome.storage.local.get<{ keyId: string }>(['keyId']);
    });

    const jwksBefore = await getJWKS(page, jwksUrl);
    expect(jwksBefore.keys.length).toBeGreaterThanOrEqual(0);
    expect(jwksBefore.keys.find((key) => key.kid === keyId)).toBeUndefined();

    pause.resolve();
    const { accountId, walletId } = await promise;

    const jwks = await getJWKS(page, jwksUrl);
    expect(jwks.keys.length).toBeGreaterThan(0);
    const key = jwks.keys.find((key) => key.kid === keyId);
    expect(key).toMatchObject({ kid: keyId });

    return { accountId, walletId, keyId };
  });

  await test.step('shows connect consent page', async () => {
    await page.waitForURL((url) =>
      url.pathname.startsWith('/grant-interactions'),
    );
    await waitForGrantConsentPage(page);
  });

  await test.step('connects', async () => {
    const continueWaitMs = await continueWaitMsPromise;
    await acceptGrant(page, continueWaitMs);
    await waitForWelcomePage(page);

    expect(
      await background.evaluate(() => chrome.storage.local.get(['connected'])),
    ).toEqual({ connected: true });
  });

  await test.step('revoke key', async () => {
    await revokeKey(page, revokeInfo);

    const { keys } = await getJWKS(page, jwksUrl);
    expect(keys.find((key) => key.kid === revokeInfo.keyId)).toBeUndefined();
  });

  await test.step('disconnect wallet', async () => {
    await disconnectWallet(popup);
  });
});
