import { test, expect } from './fixtures/base';
import { withResolvers, getJWKS } from '@/shared/helpers';
import { disconnectWallet, fillPopup } from './pages/popup';
import {
  URLS,
  login,
  revokeKey,
  waitForGrantConsentPage,
} from './helpers/chimoney';
import { waitForWelcomePage } from './helpers/common';
import { getStorage } from './fixtures/helpers';

const TEST_CASES = [
  {
    name: 'Chimoney Web',
    type: 'business' as const,
    username: process.env.CHIMONEY_USERNAME!,
    password: process.env.CHIMONEY_PASSWORD!,
    walletAddressUrl: process.env.CHIMONEY_WALLET_ADDRESS_URL!,
  },
  {
    name: 'Chimoney App',
    type: 'app' as const,
    username: process.env.CHIMONEY_APP_USERNAME!,
    password: process.env.CHIMONEY_APP_PASSWORD!,
    walletAddressUrl: process.env.CHIMONEY_APP_WALLET_ADDRESS_URL!,
  },
];

for (const testCase of TEST_CASES) {
  test.describe('Connect to Chimoney wallet with auto key addition when not logged-in to wallet', () => {
    const walletUrl = process.env.CHIMONEY_WALLET_ORIGIN!;

    const { username, password, walletAddressUrl } = testCase;
    test.skip(
      !username || !password || !walletAddressUrl || !walletUrl,
      'Missing credentials',
    );

    test.slow(true, 'Pages are slow due to Firebase on client');

    test.beforeEach('ensure not logged in', async ({ context, page }) => {
      await context.clearCookies();

      await page.goto(URLS.keyPage);
      await page.waitForURL((url) => url.href.startsWith(URLS.login), {
        timeout: 5000,
      });
      await expect(page).toHaveURL((url) => url.href.startsWith(URLS.login));
      await page.close();
    });

    test.afterEach('disconnectWallet', async ({ popup, background }) => {
      const { connected } = await getStorage(background, ['connected']);
      if (!connected) return;
      await disconnectWallet(popup);
    });

    test(testCase.name, async ({ page, popup, context, background, i18n }) => {
      const walletURL = new URL(walletUrl);
      const { keyId } = await getStorage(background, ['keyId']);

      const connectButton = await test.step('fill popup', async () => {
        const connectButton = await fillPopup(popup, i18n, {
          walletAddressUrl,
          amount: '10',
          recurring: false,
        });
        return connectButton;
      });

      await test.step('asks for key-add consent', async () => {
        await connectButton.click();
        await popup.waitForSelector(
          `[data-testid="connect-wallet-auto-key-consent"]`,
        );

        await expect(
          popup.getByTestId('connect-wallet-auto-key-consent'),
        ).toBeVisible();
        await popup
          .getByRole('button', {
            name: i18n.getMessage(
              'connectWalletKeyService_label_consentAccept',
            ),
          })
          .click();
      });

      await test.step('ensure key not already added', async () => {
        const jwksBefore = await getJWKS(walletAddressUrl);
        expect(jwksBefore.keys.length).toBeGreaterThanOrEqual(0);
        expect(
          jwksBefore.keys.find((key) => key.kid === keyId),
        ).toBeUndefined();
      });

      const LOGIN_PAGE_LINK_TEXT =
        testCase.type === 'business'
          ? 'Switch to Business Login'
          : 'Switch to App Login';

      page = await test.step('shows login page', async () => {
        const openedPage = await context.waitForEvent('page', (page) =>
          page.url().startsWith(walletUrl),
        );
        await openedPage.waitForURL((url) => url.href.startsWith(URLS.login));
        await expect(openedPage.locator('form')).toBeVisible();
        const url = openedPage.url();
        if (
          (url.includes('/app') && testCase.type !== 'app') ||
          (url.includes('/business') && testCase.type !== 'business')
        ) {
          await openedPage
            .locator('a', { hasText: LOGIN_PAGE_LINK_TEXT })
            .click();
          await expect(openedPage.locator('form')).toBeVisible();
        }
        await openedPage.waitForURL((url) =>
          url.href.startsWith(`${URLS.login}interledger/${testCase.type}`),
        );
        await login(openedPage, { username, password });
        await openedPage.waitForURL((url) => url.href.startsWith(URLS.keyPage));
        await expect(openedPage.locator('h5')).toHaveText(
          'Interledger Wallet Address Info',
        );

        return openedPage;
      });

      await test.step('adds key to wallet', async () => {
        const { resolve, reject, promise } = withResolvers<{
          status: string;
        }>();
        page.on('requestfinished', async function intercept(req) {
          if (req.serviceWorker()) return;
          if (req.method() !== 'POST') return;
          const url = new URL(req.url());
          const { origin, pathname: p } = url;
          if (origin !== walletURL.origin) return;

          if (p.startsWith('/api/interledger/create-user-wallet-address-key')) {
            page.off('requestfinished', intercept);

            const res = await req.response();
            if (!res) {
              return reject('no response from /upload-key API');
            }
            if (!res.ok) {
              return reject(
                `Failed to upload public key (${res.statusText()})`,
              );
            }

            const json: { status: string } = await res.json();
            resolve(json);
          }
        });

        await expect(promise).resolves.toEqual({
          status: 'success',
          data: 'success',
        });

        const jwks = await getJWKS(walletAddressUrl);
        expect(jwks.keys.length).toBeGreaterThan(0);
        const key = jwks.keys.find((key) => key.kid === keyId);
        expect(key).toMatchObject({ kid: keyId });

        await promise;
      });

      await test.step('shows connect consent page', async () => {
        await waitForGrantConsentPage(page);
        await expect(
          page.getByRole('button', { name: 'Accept', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Decline', exact: true }),
        ).toBeVisible();
      });

      await test.step('connects', async () => {
        await page.getByRole('button', { name: 'Accept', exact: true }).click();
        await waitForWelcomePage(page);
        await expect(background).toHaveStorage({ connected: true });
      });

      await test.step('cleanup: revoke key', async () => {
        const res = await revokeKey(page, keyId);
        expect(res).toEqual({ status: 'success', data: 'success' });

        const { keys } = await getJWKS(walletAddressUrl);
        expect(keys.find((key) => key.kid === keyId)).toBeUndefined();
      });
    });
  });
}
