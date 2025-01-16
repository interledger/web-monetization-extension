import { test, expect } from './fixtures/connected';
import { setupPlayground } from './helpers/common';

test.beforeEach(async ({ popup }) => {
  await popup.reload();
});

test.skip('should monetize site with single wallet address', async ({
  page,
  popup,
}) => {
  const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
  const monetizationCallback = await setupPlayground(page, walletAddressUrl);

  await page.waitForSelector('#link-events .log-header');
  await page.waitForSelector('#link-events ul.events li');
  await expect(page.locator('#link-events ul.events li').last()).toContainText(
    'Load Event',
  );

  await expect(monetizationCallback).toHaveBeenCalledTimes(1);
  await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
    paymentPointer: walletAddressUrl,
    amountSent: {
      currency: expect.stringMatching(/^[A-Z]{3}$/),
      value: expect.stringMatching(/^0\.\d+$/),
    },
    incomingPayment: expect.stringContaining(new URL(walletAddressUrl).origin),
  });

  await popup.reload({ waitUntil: 'networkidle' });
  await page.bringToFront();
  await popup.waitForSelector(`[data-testid="home-page"]`);

  await expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();
  expect(await popup.getByRole('textbox').all()).toHaveLength(1);
});

test('does not monetize when continuous payments are disabled', async ({
  page,
  popup,
  background,
}) => {
  const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

  await test.step('disable continuous payments', async () => {
    await expect(background).toHaveStorage({ continuousPaymentsEnabled: true });

    const settingsLink = popup.locator(`[href="/settings"]`).first();
    await settingsLink.click();

    await popup.bringToFront();
    await popup.getByRole('tab', { name: 'Rate' }).click();
    await popup
      .getByTestId('continuous-payments-toggle')
      .uncheck({ force: true });

    await expect(
      popup.getByRole('tabpanel', { name: 'Rate' }).locator('p'),
    ).toContainText('Ongoing payments are now disabled');

    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: false,
    });
  });

  const monetizationCallback = await setupPlayground(page, walletAddressUrl);

  await test.step('check continuous payments do not go through', async () => {
    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: false,
    });

    await page.waitForSelector('#link-events .log-header');
    await page.waitForSelector('#link-events ul.events li');
    await expect(
      page.locator('#link-events ul.events li').last(),
    ).toContainText('Load Event');

    await expect(monetizationCallback).toHaveBeenCalledTimes(0);
  });

  await test.step('but can send one-time payment', async () => {
    await popup.reload();
    await expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();
    expect(await popup.getByRole('textbox').all()).toHaveLength(1);

    await popup.getByRole('textbox').fill('1.5');
    await popup.getByRole('button', { name: 'Send now' }).click();

    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
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

  await test.step('and re-enabling lets send continuous payments', async () => {
    const settingsLink = popup.locator(`[href="/settings"]`).first();
    await settingsLink.click();

    await popup.bringToFront();
    await popup.getByRole('tab', { name: 'Rate' }).click();
    await popup
      .getByTestId('continuous-payments-toggle')
      .check({ force: true });

    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: true,
    });

    await expect(monetizationCallback).toHaveBeenCalledTimes(2);
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      paymentPointer: walletAddressUrl,
      amountSent: {
        currency: expect.stringMatching(/^[A-Z]{3}$/),
        value: expect.stringMatching(/^0\.\d+$/),
      },
      incomingPayment: expect.stringContaining(
        new URL(walletAddressUrl).origin,
      ),
    });
  });
});
