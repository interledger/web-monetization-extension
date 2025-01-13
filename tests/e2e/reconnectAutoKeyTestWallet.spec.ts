import { test, expect } from './fixtures/base';
import { getJWKS, withResolvers } from '@/shared/helpers';
import {
  acceptGrant,
  API_URL_ORIGIN,
  DEFAULT_CONTINUE_WAIT_MS,
  revokeKey,
  waitForGrantConsentPage,
} from './helpers/testWallet';
import { getStorage } from './fixtures/helpers';
import { spy } from 'tinyspy';
import {
  getContinueWaitTime,
  waitForWelcomePage,
  waitForReconnectWelcomePage,
} from './helpers/common';
import { disconnectWallet, fillPopup } from './pages/popup';

test('Reconnect to test wallet with automatic key addition', async ({
  page,
  popup,
  persistentContext: context,
  background,
  i18n,
}) => {
  const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
  const monetizationCallback = spy<[Event], void>();
  const revokeInfo = await test.step('connect wallet', async () => {
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

      expect(
        popup.getByTestId('connect-wallet-auto-key-consent'),
      ).toBeVisible();
      await popup
        .getByRole('button', {
          name: i18n.getMessage('connectWalletKeyService_label_consentAccept'),
        })
        .click();
    });

    const continueWaitMsPromise = getContinueWaitTime(
      context,
      { walletAddressUrl },
      DEFAULT_CONTINUE_WAIT_MS,
    );

    const revokeInfo = await test.step('adds key to wallet', async () => {
      page = await context.waitForEvent('page', {
        predicate: (page) =>
          page
            .url()
            .includes(
              `${process.env.TEST_WALLET_ORIGIN}/settings/developer-keys`,
            ),
        timeout: 3 * 1000,
      });

      const { resolve, reject, promise } = withResolvers<{
        accountId: string;
        walletId: string;
      }>();
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
        const result = match.groups as { accountId: string; walletId: string };

        const res = await req.response();
        page.off('requestfinished', intercept);
        if (!res) {
          reject('no response from /upload-key API');
        } else {
          resolve(result);
        }
      });

      const { keyId } = await getStorage(background, ['keyId']);
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

    return revokeInfo;
  });

  await test.step('start monetization', async () => {
    const playgroundUrl = 'https://webmonetization.org/play/';
    await page.goto(playgroundUrl);

    await page.exposeFunction('monetizationCallback', monetizationCallback);
    await page.evaluate(() => {
      window.addEventListener('monetization', monetizationCallback);
    });

    await page
      .getByLabel('Wallet address/Payment pointer')
      .fill(walletAddressUrl);
    await page.getByRole('button', { name: 'Add monetization link' }).click();

    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
  });

  await test.step('revoke key', async () => {
    const newPage = await context.newPage();
    await revokeKey(newPage, revokeInfo);
    newPage.close();

    const { keys } = await getJWKS(walletAddressUrl);
    expect(keys.find((key) => key.kid === revokeInfo.keyId)).toBeUndefined();
  });

  await test.step('trigger key-revoked state by making one-time payment', async () => {
    await expect(monetizationCallback).toHaveBeenCalledTimes(1);

    await popup.waitForSelector(`[data-testid="home-page"]`);

    await expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();
    expect(await popup.getByRole('textbox').all()).toHaveLength(1);

    await popup.getByRole('textbox').fill('1.5');
    await popup.getByRole('button', { name: 'Send now' }).click();

    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
  });

  await test.step('asks for key-add consent to reconnect wallet', async () => {
    await expect(
      popup.getByRole('button', {
        name: i18n.getMessage('keyRevoked_action_reconnect'),
      }),
    ).toBeVisible();
    await popup
      .getByRole('button', {
        name: i18n.getMessage('keyRevoked_action_reconnect'),
      })
      .click();

    await popup.waitForSelector(
      `[data-testid="connect-wallet-auto-key-consent"]`,
    );

    expect(popup.getByTestId('connect-wallet-auto-key-consent')).toBeVisible();
    await popup
      .getByRole('button', {
        name: i18n.getMessage('connectWalletKeyService_label_consentAccept'),
      })
      .click();

    const newPage = await context.waitForEvent('page', {
      predicate: (page) =>
        page
          .url()
          .includes(
            `${process.env.TEST_WALLET_ORIGIN}/settings/developer-keys`,
          ),
      timeout: 3 * 1000,
    });

    await waitForReconnectWelcomePage(newPage);
    newPage.close();
  });

  await test.step('make one-time payment after reconnecting the wallet', async () => {
    await popup.reload({ waitUntil: 'networkidle' });
    await popup.waitForSelector(`[data-testid="home-page"]`);
    await expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();

    await popup.getByRole('textbox').fill('1.5');
    await popup.getByRole('button', { name: 'Send now' }).click();

    await expect(monetizationCallback).toHaveBeenCalledTimes(2, {
      timeout: 1000,
    });
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      paymentPointer: walletAddressUrl,
      amountSent: {
        currency: expect.stringMatching(/^[A-Z]{3}$/),
        value: expect.stringMatching(/^1\.\d+$/),
      },
      incomingPayment: expect.stringContaining(
        new URL(walletAddressUrl).origin,
      ),
    });
  });

  await test.step('revoke keys and disconnect wallet', async () => {
    await revokeKey(page, revokeInfo);
    await disconnectWallet(popup);
  });
});
