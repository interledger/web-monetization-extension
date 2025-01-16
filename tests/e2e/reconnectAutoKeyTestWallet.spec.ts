import { test, expect } from './fixtures/base';
import { getJWKS, withResolvers } from '@/shared/helpers';
import {
  acceptGrant,
  API_URL_ORIGIN,
  DEFAULT_CONTINUE_WAIT_MS,
  KEYS_PAGE_URL,
  revokeKey,
  waitForGrantConsentPage,
} from './helpers/testWallet';
import { getStorage } from './fixtures/helpers';
import { spy } from 'tinyspy';
import {
  getContinueWaitTime,
  waitForWelcomePage,
  waitForReconnectWelcomePage,
  setupPlayground,
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
        predicate: (page) => page.url().startsWith(KEYS_PAGE_URL),
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

  await test.step('revoke key', async () => {
    const newPage = await context.newPage();
    await revokeKey(newPage, revokeInfo);
    await newPage.close();

    const { keys } = await getJWKS(walletAddressUrl);
    expect(keys.find((key) => key.kid === revokeInfo.keyId)).toBeUndefined();
  });

  const monetizationCallback = await setupPlayground(page, walletAddressUrl);
  await test.step('start monetization', async () => {
    await expect(monetizationCallback).toHaveBeenCalledTimes(0);
  });

  await test.step('asks for key-add consent to reconnect wallet', async () => {
    const reconnectButton = popup.getByRole('button', {
      name: i18n.getMessage('keyRevoked_action_reconnect'),
    });
    await expect(reconnectButton).toBeVisible();
    await reconnectButton.click();

    expect(popup.getByTestId('connect-wallet-auto-key-consent')).toBeVisible();
    await popup
      .getByRole('button', {
        name: i18n.getMessage('connectWalletKeyService_label_consentAccept'),
      })
      .click();

    const newPage = await context.waitForEvent('page', {
      predicate: (page) => page.url().startsWith(KEYS_PAGE_URL),
    });

    await waitForReconnectWelcomePage(newPage);
    await newPage.close();
  });

  await test.step('make one-time payment after reconnecting the wallet', async () => {
    await popup.reload();
    await expect(popup.getByTestId('home-page')).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();

    await popup.getByRole('textbox').fill('1.5');
    await popup.getByRole('button', { name: 'Send now' }).click();

    await expect(monetizationCallback).toHaveBeenCalledTimes(1, {
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
    await disconnectWallet(popup);
    await revokeKey(page, revokeInfo);
  });
});
