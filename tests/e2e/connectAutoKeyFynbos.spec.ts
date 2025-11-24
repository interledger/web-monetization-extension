import { test, expect } from './fixtures/base';
import { getJWKS, withResolvers } from '@/shared/helpers';
import { disconnectWallet, fillPopup } from './pages/popup';
import {
  getContinueWaitTime,
  waitForWelcomePage,
  totpGenerator,
} from './helpers/common';
import {
  acceptGrant,
  KEYS_PAGE_URL,
  LOGIN_PAGE_URL,
  revokeKey,
  waitForGrantConsentPage,
} from './helpers/fynbos';
import { getStorage } from './fixtures/helpers';

test('Connect to Fynbos with automatic key addition when not logged-in to wallet', async ({
  page,
  popup,
  context,
  background,
  i18n,
}) => {
  const username = process.env.FYNBOS_USERNAME!;
  const password = process.env.FYNBOS_PASSWORD!;
  const walletAddressUrl = process.env.FYNBOS_WALLET_ADDRESS_URL!;
  const totpDetails = process.env.FYNBOS_TOTP_DETAILS!;

  test.skip(
    !username || !password || !walletAddressUrl || !totpDetails,
    'Missing credentials',
  );

  const { keyId: kid } = await getStorage(background, ['keyId']);

  const connectButton = await test.step('fill popup', async () => {
    const connectButton = await fillPopup(popup, i18n, {
      walletAddressUrl,
      amount: '10',
      recurring: false,
    });
    return connectButton;
  });

  await test.step('ensure not logged in', async () => {
    await page.goto(KEYS_PAGE_URL);
    await expect(page).toHaveURL(LOGIN_PAGE_URL);
    await page.close();
  });

  await test.step('ensure key not added already', async () => {
    const jwksBefore = await getJWKS(walletAddressUrl);
    expect(jwksBefore.keys.length).toBeGreaterThanOrEqual(0);
    expect(jwksBefore.keys.find((key) => key.kid === kid)).toBeUndefined();
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

  page = await test.step('shows login page', async () => {
    const openedPage = await context.waitForEvent('page', (page) =>
      page.url().startsWith(LOGIN_PAGE_URL),
    );
    await openedPage.getByLabel('Email').fill(username);
    await openedPage.getByLabel('Password').fill(password);
    await openedPage.getByRole('button', { name: 'Log in' }).click();

    await openedPage.waitForURL((url) =>
      url.pathname.startsWith('/totp/challenge'),
    );
    const { otp } = await totpGenerator(totpDetails);
    await openedPage.getByLabel('Authenticator Code').fill(otp);
    await openedPage.getByRole('button', { name: 'Verify' }).click();

    await openedPage.waitForURL(KEYS_PAGE_URL);
    await expect(openedPage.locator('h1').first()).toHaveText('Keys');

    return openedPage;
  });

  const continueWaitMsPromise = getContinueWaitTime(context, {
    walletAddressUrl,
  });

  const keyNickName = await test.step('adds key to wallet', async () => {
    const { resolve, promise } = withResolvers<string>();
    page.on('request', function interceptApplicationName(req) {
      if (req.serviceWorker()) return;
      if (req.method() !== 'POST') return;

      const url = new URL(req.url());
      if (
        url.pathname.startsWith('/settings/keys/add-public') &&
        url.searchParams.get('_data') === 'routes/settings_.keys_.add-public'
      ) {
        const applicationName = req.postDataJSON()?.applicationName as string;
        resolve(applicationName);
        page.off('request', interceptApplicationName);
      }
    });
    const keyNickName = await promise;
    expect(keyNickName).not.toBeFalsy();

    await waitForGrantConsentPage(page);

    const jwks = await getJWKS(walletAddressUrl);
    expect(jwks.keys.length).toBeGreaterThan(0);
    const key = jwks.keys.find((key) => key.kid === kid);
    expect(key).toMatchObject({ kid });

    return keyNickName;
  });

  await test.step('shows wallet consent page', async () => {
    await waitForGrantConsentPage(page);
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  });

  await test.step('connects', async () => {
    const continueWaitMs = await continueWaitMsPromise;
    await acceptGrant(page, continueWaitMs);
    await waitForWelcomePage(page);

    await expect(background).toHaveStorage({ connected: true });
  });

  await test.step('cleanup: revoke keys', async () => {
    const keyIds = await test.step('get keys to revoke', async () => {
      await page.goto(KEYS_PAGE_URL);
      const data = await page.evaluate(async () => {
        const res = await fetch(
          `/settings/keys?_data=${encodeURIComponent('routes/settings.keys')}`,
          { credentials: 'include' },
        );
        const data = await res.json();
        return data as {
          keys: {
            id: string;
            applicationName: string;
            publicKeyFingerprint: string;
          }[];
        };
      });

      return data.keys
        .filter((e) => e.applicationName === keyNickName)
        .map((e) => e.id);
    });

    test.slow(keyIds.length > 2, 'Revoking lots of older keys too');

    await test.step(`revoke keys (${keyIds.length})`, async () => {
      for (const keyId of keyIds) {
        await test.step(`revoke key ${keyId}`, async () => {
          await revokeKey(page, keyId);
        });
      }

      const { keys } = await getJWKS(walletAddressUrl);
      expect(keys.find((key) => key.kid === kid)).toBeUndefined();
    });
  });

  await test.step('cleanup: disconnect wallet', async () => {
    await disconnectWallet(popup);
  });
});
