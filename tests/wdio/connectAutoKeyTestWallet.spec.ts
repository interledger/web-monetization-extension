import { getJWKS } from '@/background/utils';
import { revokeKey } from '@/content/keyAutoAdd/lib/helpers/testWallet';
import {
  acceptConsent,
  acceptGrant,
  click,
  closeWindows,
  disconnectWallet,
  fillConnectForm,
  getStorage,
  openPopup,
  switchToUrl,
  t,
  waitForPostConnect,
} from './fixtures/helpers';

const TEST_CASES = [
  {
    name: 'test wallet',
    walletAddressUrl: process.env.TEST_WALLET_ADDRESS_URL,
    username: process.env.TEST_WALLET_USERNAME,
    password: process.env.TEST_WALLET_PASSWORD,
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

describe('Connect with auto key addition when not logged-in to wallet', () => {
  let main: string;

  before(async () => {
    main = await browser.getWindowHandle();
    await acceptConsent(main);
  });

  afterEach(async () => {
    await browser.mockRestoreAll();
    const handles = await browser.getWindowHandles();
    await closeWindows(
      handles.filter((h) => h !== main),
      main,
    );
  });

  for (const testCase of TEST_CASES) {
    const { username, password, walletAddressUrl, walletUrl } = testCase;

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
        : origin.replace('https://wallet.', 'https://api-wallet.');

    it(testCase.name, async function () {
      if (!username || !password || !walletAddressUrl) {
        this.skip();
      }

      const popup = await openPopup(main);
      const connect = await fillConnectForm(walletAddressUrl);

      await browser.switchToWindow(main);
      await browser.storageDeleteCookies({});
      await browser.url(KEYS_PAGE_URL);
      await expect(browser).toHaveUrl(LOGIN_PAGE_URL);
      // Leave the login page so only the tab the extension opens shows it.
      await browser.url('about:blank');

      await browser.switchToWindow(popup);
      await click(connect);
      await $(
        '[data-testid="connect-wallet-auto-key-consent"]',
      ).waitForDisplayed();
      await click(
        `button=${await t('connectWalletKeyService_consentAccept_action')}`,
      );

      // Checked before logging in, as the key is only uploaded after that.
      const { keyId } = await getStorage(['keyId']);
      if (!keyId) {
        throw new Error('no keyId in storage');
      }
      const jwksBefore = await getJWKS(walletAddressUrl);
      expect(jwksBefore.keys.find((key) => key.kid === keyId)).toBeUndefined();

      // Set up before logging in, as the key is uploaded right after that.
      const uploads = await browser.mock(
        `${API_URL_ORIGIN}/accounts/*/wallet-addresses/*/upload-key`,
        { method: 'post' },
      );

      await switchToUrl((url) => url.startsWith(LOGIN_PAGE_URL));
      await $('input[name="email"]').setValue(username);
      await $('input[name="password"]').setValue(password);
      await click('button[type="submit"]');
      await browser.waitUntil(
        async () => (await browser.getUrl()) === KEYS_PAGE_URL,
        { timeout: 20_000 },
      );
      await expect($('h1')).toHaveText('Developer Keys');

      await browser.waitUntil(() => uploads.calls.length > 0, {
        timeout: 20_000,
      });
      const pattern =
        /^\/accounts\/(?<accountId>.+)\/wallet-addresses\/(?<walletId>.+)\/upload-key$/;
      const match = new URL(uploads.calls[0].request.url).pathname.match(
        pattern,
      );
      if (!match?.groups) {
        throw new Error('no match for URL pattern');
      }
      const { accountId, walletId } = match.groups;

      await browser.waitUntil(async () => {
        const { keys } = await getJWKS(walletAddressUrl);
        return keys.some((key) => key.kid === keyId);
      });

      await browser.waitUntil(async () => {
        const url = new URL(await browser.getUrl());
        return (
          url.pathname.startsWith('/grant-interactions') &&
          url.searchParams.has('interactId') &&
          url.searchParams.has('nonce') &&
          url.searchParams.has('clientUri')
        );
      });

      await acceptGrant();
      await waitForPostConnect();
      await browser.waitUntil(
        async () => (await getStorage(['connected'])).connected,
        { timeout: 30_000, interval: 1000 },
      );

      await browser.url(KEYS_PAGE_URL);
      await browser.execute(revokeKey, {
        apiOrigin: API_URL_ORIGIN,
        accountId,
        walletId,
        keyId,
      });
      const { keys } = await getJWKS(walletAddressUrl);
      expect(keys.find((key) => key.kid === keyId)).toBeUndefined();

      await browser.switchToWindow(popup);
      await disconnectWallet();
    });
  }
});
