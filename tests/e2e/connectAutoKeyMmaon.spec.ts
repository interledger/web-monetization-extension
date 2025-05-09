import { test, expect } from './fixtures/base';
import { withResolvers, getJWKS } from '@/shared/helpers';
import { fillPopup } from './pages/popup';
import { URLS, login, revokeKey } from './helpers/mmaon';
import { waitForPage } from './helpers/common';
import { getStorage } from './fixtures/helpers';

test('Connect to MMAON wallet with automatic key addition when not logged-in to wallet', async ({
  page,
  popup,
  context,
  background,
  i18n,
}) => {
  const username = process.env.MMAON_USERNAME!;
  const password = process.env.MMAON_PASSWORD!;
  const walletAddressUrl = process.env.MMAON_WALLET_ADDRESS_URL!;
  const walletUrl = process.env.MMAON_WALLET_ORIGIN!;

  test.skip(
    !username || !password || !walletAddressUrl || !walletUrl,
    'Missing credentials',
  );

  const walletURL = new URL(walletUrl);
  const { keyId: kid } = await getStorage(background, ['keyId']);

  const connectButton = await test.step('fill popup', async () => {
    const connectButton = await fillPopup(popup, i18n, {
      walletAddressUrl,
      amount: '100',
      recurring: false,
    });
    return connectButton;
  });

  await test.step('ensure not logged in', async () => {
    await context.clearCookies();

    await page.goto(URLS.keyPage);
    await page.waitForURL((url) => url.href.startsWith(URLS.login));
    await expect(page).toHaveURL((url) => url.href.startsWith(URLS.loginFull));
    await page.close();
  });

  await test.step('ensure key not already added', async () => {
    const jwksBefore = await getJWKS(walletAddressUrl);
    expect(jwksBefore.keys.length).toBeGreaterThanOrEqual(0);
    expect(jwksBefore.keys.find((key) => key.kid === kid)).toBeUndefined();
  });

  await test.step('asks for key-add consent', async () => {
    await connectButton.click();
    await popup.waitForSelector(
      `[data-testid="connect-wallet-auto-key-consent"]`,
    );

    await popup
      .getByRole('button', {
        name: i18n.getMessage('connectWalletKeyService_label_consentAccept'),
      })
      .click();
  });

  page = await test.step('shows login page', async () => {
    const openedPage = await waitForPage(context, (url) =>
      url.startsWith(walletUrl),
    );
    await openedPage.waitForURL((url) => url.href.startsWith(URLS.loginFull));
    await login(openedPage, { username, password });
    await openedPage.waitForURL((url) => url.href.startsWith(URLS.keyPage));
    return openedPage;
  });

  const revokeInfo = await test.step('adds key to wallet', async () => {
    const { resolve, reject, promise } = withResolvers<{ keyId: string }>();
    page.on('requestfinished', async function intercept(req) {
      if (req.serviceWorker()) return;
      if (req.method() !== 'POST') return;
      const url = new URL(req.url());
      const { origin, pathname: p } = url;
      if (origin !== walletURL.origin) return;

      if (p.startsWith('/api/open-payments/upload-keys')) {
        page.off('requestfinished', intercept);

        const res = await req.response();
        if (!res) {
          return reject('no response from /upload-keys API');
        }
        if (!res.ok) {
          return reject(`Failed to upload public key (${res.statusText})`);
        }

        const json = await res.json();
        resolve(json);
      }
    });

    await expect(promise).resolves.toMatchObject({
      keyId: expect.any(String),
    });

    const jwks = await getJWKS(walletAddressUrl);
    expect(jwks.keys.length).toBeGreaterThan(0);
    const key = jwks.keys.find((key) => key.kid === kid);
    expect(key).toMatchObject({ kid });

    return await promise;
  });

  /* // TODO https://github.com/interledger/web-monetization-extension/issues/1050
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

  await test.step('cleanup: disconnect wallet', async () => {
    await disconnectWallet(popup);
  });
  */

  await test.step('cleanup: revoke key', async () => {
    const res = await revokeKey(page, { keyId: revokeInfo.keyId });
    expect.soft(res).toMatchObject({ success: true });

    const { keys } = await getJWKS(walletAddressUrl);
    expect(keys.find((key) => key.kid === kid)).toBeUndefined();
  });
});
