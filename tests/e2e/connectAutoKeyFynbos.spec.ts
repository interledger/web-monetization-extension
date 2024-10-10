import { test, expect } from './fixtures/base';
import { getJWKS } from '@/shared/helpers';
import { disconnectWallet, fillPopup } from './pages/popup';
import { waitForWelcomePage } from './helpers/common';
import {
  acceptGrant,
  getContinueWaitTime,
  KEYS_PAGE_URL,
  LOGIN_PAGE_URL,
  revokeKey,
  waitForGrantConsentPage,
} from './helpers/fynbos';

const origin = new URL(KEYS_PAGE_URL).origin;

test('Connect to Fynbos with automatic key addition when not logged-in to wallet', async ({
  page,
  popup,
  persistentContext: context,
  background,
  i18n,
}) => {
  const username = process.env.FYNBOS_USERNAME!;
  const password = process.env.FYNBOS_PASSWORD!;
  const walletAddressUrl = process.env.FYNBOS_WALLET_ADDRESS_URL!;

  test.skip(!username || !password || !walletAddressUrl, 'Missing credentials');

  const { keyId: kid } = await background.evaluate(() => {
    return chrome.storage.local.get<{ keyId: string }>(['keyId']);
  });

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
    expect(page.url()).toBe(LOGIN_PAGE_URL);
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

    expect(popup.getByTestId('connect-wallet-auto-key-consent')).toBeVisible();
    await popup
      .getByRole('button', {
        name: i18n.getMessage('connectWalletKeyService_label_consentAccept'),
      })
      .click();
  });

  page = await test.step('shows login page', async () => {
    const openedPage = await context.waitForEvent('page', {
      predicate: (page) => page.url().startsWith(LOGIN_PAGE_URL),
      timeout: 3 * 1000,
    });
    await openedPage.getByLabel('Email').fill(username);
    await openedPage.getByLabel('Password').fill(password);
    await openedPage.getByRole('button', { name: 'Log in' }).click();
    await openedPage.waitForURL(KEYS_PAGE_URL);
    await expect(openedPage.locator('h1').first()).toHaveText('Keys');

    return openedPage;
  });

  const continueWaitMsPromise = getContinueWaitTime(context, {
    walletAddressUrl,
  });

  const revokeInfo = await test.step('adds key to wallet', async () => {
    const applicationName = await new Promise<string>((resolve) => {
      page.on('request', async function interceptApplicationName(req) {
        if (req.serviceWorker()) return;
        if (req.method() !== 'POST') return;

        const url = new URL(req.url());
        if (
          url.pathname.startsWith('/settings/keys/add-public') &&
          url.searchParams.get('_data') === 'routes/settings_.keys_.add-public'
        ) {
          const applicationName = req.postDataJSON()?.applicationName;
          if (applicationName) {
            resolve(applicationName);
            page.off('requestfinished', interceptApplicationName);
          }
        }
      });
    });

    const keyIds = await new Promise<string[]>((resolve, reject) => {
      page.on('requestfinished', async function interceptKeyIds(req) {
        if (req.serviceWorker()) return;

        if (req.method() !== 'GET') return;
        const url = new URL(req.url());
        // https://eu1.fynbos.dev/settings/keys?_data=routes%2Fsettings.keys
        if (url.origin !== 'https://eu1.fynbos.dev') return;
        if (!url.pathname.startsWith('/settings/keys')) return;
        if (url.searchParams.get('_data') !== 'routes/settings.keys') return;

        const res = await req.response();
        page.off('requestfinished', interceptKeyIds);
        if (!res) {
          reject('no response from routes/settings.keys API route');
          return;
        }
        type Resp = {
          keys: {
            id: string;
            applicationName: string;
            publicKeyFingerprint: string;
          }[];
        };
        const json: Resp = await res.json();
        // We want to `json.keys.find(e => e.publicKeyFingerprint ===
        // publicKeyFingerprint)` but we don't have that fingerprint handy
        const keys = json.keys.filter(
          (e) => e.applicationName === applicationName,
        );
        if (!keys.length) {
          reject('no key found');
          return;
        }
        resolve(keys.map((e) => e.id));
      });
    });

    const jwks = await getJWKS(walletAddressUrl);
    expect(jwks.keys.length).toBeGreaterThan(0);
    const key = jwks.keys.find((key) => key.kid === kid);
    expect(key).toMatchObject({ kid });

    return { keyIds };
  });

  await test.step('shows connect consent page', async () => {
    await waitForGrantConsentPage(page);
    expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  });

  await test.step('connects', async () => {
    const continueWaitMs = await continueWaitMsPromise;
    await acceptGrant(page, continueWaitMs);
    await waitForWelcomePage(page);

    expect(
      await background.evaluate(() => chrome.storage.local.get(['connected'])),
    ).toEqual({ connected: true });
  });

  await test.step(`Cleanup: revoke keys (${revokeInfo.keyIds.length})`, async () => {
    for (const keyId of revokeInfo.keyIds) {
      await test.step(`revoke key ${keyId}`, async () => {
        await revokeKey(page, origin, keyId);
      });
    }

    const { keys } = await getJWKS(walletAddressUrl);
    expect(keys.find((key) => key.kid === kid)).toBeUndefined();
  });

  await test.step('Cleanup: disconnect wallet', async () => {
    await disconnectWallet(popup);
  });
});
