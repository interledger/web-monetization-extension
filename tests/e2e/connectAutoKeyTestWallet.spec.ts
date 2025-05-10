import { test, expect } from './fixtures/base';
import { withResolvers, getJWKS } from '@/shared/helpers';
import { disconnectWallet, fillPopup } from './pages/popup';
import {
  getContinueWaitTime,
  waitForPage,
  waitForWelcomePage,
} from './helpers/common';
import {
  acceptGrant,
  DEFAULT_CONTINUE_WAIT_MS,
  revokeKey,
  waitForGrantConsentPage,
} from './helpers/testWallet';
import { getStorage } from './fixtures/helpers';

const TEST_CASES = [
  {
    name: 'test wallet',
    walletAddressUrl: process.env.TEST_WALLET_ADDRESS_URL!,
    username: process.env.TEST_WALLET_USERNAME!,
    password: process.env.TEST_WALLET_PASSWORD!,
    walletUrl: 'https://wallet.interledger-test.dev',
  },
  {
    name: 'interledger.cards',
    walletAddressUrl: process.env.INTERLEDGER_CARDS_WALLET_ADDRESS_URL,
    username: process.env.INTERLEDGER_CARDS_USERNAME,
    password: process.env.INTERLEDGER_CARDS_PASSWORD,
    walletUrl: 'https://wallet.interledger.cards',
  },
  {
    name: 'interledger.cards with $ilp.dev',
    walletAddressUrl: process.env.INTERLEDGER_CARDS_ILP_DEV_WALLET_ADDRESS_URL,
    username: process.env.INTERLEDGER_CARDS_USERNAME,
    password: process.env.INTERLEDGER_CARDS_PASSWORD,
    walletUrl: 'https://wallet.interledger.cards',
  },
];

for (const testCase of TEST_CASES) {
  test.describe('Connect with auto key addition when not logged-in to wallet', () => {
    const { username, password, walletAddressUrl, walletUrl } = testCase;

    test.skip(
      !username || !password || !walletAddressUrl,
      'Missing credentials',
    );

    const origin = new URL(walletUrl).origin;
    const LOGIN_PAGE_URL = (() => {
      const url = new URL('/auth/login', origin);
      url.searchParams.set('callbackUrl', '/settings/developer-keys');
      return url.href;
    })();
    const KEYS_PAGE_URL = new URL('/settings/developer-keys', origin).href;
    const API_URL_ORIGIN =
      origin === 'https://wallet.interledger.cards'
        ? origin.replace('https://wallet.', 'https://api.')
        : origin.replace('https://wallet.', 'https://api.wallet.');

    test(testCase.name, async ({ page, popup, context, background, i18n }) => {
      if (!username || !password || !walletAddressUrl) return;

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
        await expect(page).toHaveURL(LOGIN_PAGE_URL);
        await page.close();
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

      page = await test.step('shows login page', async () => {
        const openedPage = await waitForPage(context, (url) =>
          url.startsWith(LOGIN_PAGE_URL),
        );
        await openedPage.getByLabel('E-mail').fill(username);
        await openedPage.getByLabel('Password').fill(password);
        await openedPage.getByRole('button', { name: 'login' }).click();
        await openedPage.waitForURL(KEYS_PAGE_URL);
        await expect(openedPage.locator('h1')).toHaveText('Developer Keys');

        return openedPage;
      });

      const continueWaitMsPromise = getContinueWaitTime(
        context,
        { walletAddressUrl },
        DEFAULT_CONTINUE_WAIT_MS,
      );

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
          if (url.origin !== API_URL_ORIGIN) return;
          if (!url.pathname.startsWith('/accounts/')) return;
          if (!url.pathname.includes('/upload-key')) return;

          const pattern =
            /^\/accounts\/(?<accountId>.+)\/wallet-addresses\/(?<walletId>.+)\/upload-key$/;
          const match = url.pathname.match(pattern);
          if (!match) {
            throw new Error('no match for URL pattern');
          }
          const result = match.groups as {
            accountId: string;
            walletId: string;
          };

          const res = await req.response();
          page.off('requestfinished', intercept);
          if (!res) {
            reject('no response from /upload-key API');
          } else {
            await pause.promise;
            resolve(result);
          }
        });

        const { keyId } = await getStorage(background, ['keyId']);

        const jwksBefore = await getJWKS(walletAddressUrl);
        expect(jwksBefore.keys.length).toBeGreaterThanOrEqual(0);
        expect(
          jwksBefore.keys.find((key) => key.kid === keyId),
        ).toBeUndefined();

        pause.resolve();
        const { accountId, walletId } = await promise;

        const jwks = await getJWKS(walletAddressUrl);
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

        await expect(background).toHaveStorage({ connected: true });
      });

      await test.step('revoke key', async () => {
        await revokeKey(page, revokeInfo, API_URL_ORIGIN, KEYS_PAGE_URL);

        const { keys } = await getJWKS(walletAddressUrl);
        expect(
          keys.find((key) => key.kid === revokeInfo.keyId),
        ).toBeUndefined();
      });

      await test.step('disconnect wallet', async () => {
        await disconnectWallet(popup);
      });
    });
  });
}
