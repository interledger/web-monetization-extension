import { test, expect } from './fixtures/base';
import { withResolvers, getJWKS } from '@/shared/helpers';
import { disconnectWallet, fillPopup } from './pages/popup';
import {
  URLS,
  login,
  revokeKey,
  waitForGrantConsentPage,
} from './helpers/chimoney';
import { waitForPage, waitForWelcomePage } from './helpers/common';
import { getStorage } from './fixtures/helpers';

test('Connect to Chimoney wallet with automatic key addition when not logged-in to wallet', async ({
  page,
  popup,
  context,
  background,
  i18n,
}) => {
  const username = process.env.CHIMONEY_USERNAME!;
  const password = process.env.CHIMONEY_PASSWORD!;
  const walletAddressUrl = process.env.CHIMONEY_WALLET_ADDRESS_URL!;
  const walletUrl = process.env.CHIMONEY_WALLET_ORIGIN!;

  test.skip(
    !username || !password || !walletAddressUrl || !walletUrl,
    'Missing credentials',
  );

  test.slow(true, 'Some pages load slow');

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

  await test.step('ensure not logged in', async () => {
    await context.clearCookies();

    await page.goto(URLS.keyPage);
    await page.waitForURL((url) => url.href.startsWith(URLS.login), {
      timeout: 5000,
    });
    await expect(page).toHaveURL(
      (url) => url.href.startsWith(URLS.login) && url.searchParams.has('next'),
    );
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
        name: i18n.getMessage('connectWalletKeyService_label_consentAccept'),
      })
      .click();
  });

  await test.step('ensure key not already added', async () => {
    const jwksBefore = await getJWKS(walletAddressUrl);
    expect(jwksBefore.keys.length).toBeGreaterThanOrEqual(0);
    expect(jwksBefore.keys.find((key) => key.kid === keyId)).toBeUndefined();
  });

  page = await test.step('shows login page', async () => {
    const openedPage = await waitForPage(context, (url) =>
      url.startsWith(walletUrl),
    );
    await openedPage.waitForURL((url) => url.href.startsWith(URLS.login));
    await login(openedPage, { username, password });
    await openedPage.waitForURL((url) => url.href.startsWith(URLS.keyPage));
    await expect(openedPage.locator('h5')).toHaveText(
      'Interledger Wallet Address Info',
    );

    return openedPage;
  });

  await test.step('adds key to wallet', async () => {
    const { resolve, reject, promise } = withResolvers<{ status: string }>();
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
          return reject(`Failed to upload public key (${res.statusText()})`);
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
    // Chimoney asks for login before consent page additionally?
    await page.waitForURL((url) => url.href.startsWith(URLS.login));
    await login(page, { username, password });

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

  await test.step('cleanup: disconnect wallet', async () => {
    await disconnectWallet(popup);
  });
});
