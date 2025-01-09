import { spy } from 'tinyspy';
import { test, expect } from './fixtures/connected';

test.beforeEach(async ({ popup }) => {
  await popup.reload();
});

test('should monetize site with single wallet address', async ({
  page,
  popup,
}) => {
  const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
  const playgroundUrl = 'https://webmonetization.org/play/';

  await page.goto(playgroundUrl);

  const monetizationCallback = spy<[Event], void>();
  await page.exposeFunction('monetizationCallback', monetizationCallback);
  await page.evaluate(() => {
    window.addEventListener('monetization', monetizationCallback);
  });

  await page
    .getByLabel('Wallet address/Payment pointer')
    .fill(walletAddressUrl);
  await page.getByRole('button', { name: 'Add monetization link' }).click();

  await expect(page.locator('link[rel=monetization]')).toHaveAttribute(
    'href',
    walletAddressUrl,
  );

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
  const playgroundUrl = 'https://webmonetization.org/play/';

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

  await page.goto(playgroundUrl);

  const monetizationCallback = spy<[Event], void>();
  await page.exposeFunction('monetizationCallback', monetizationCallback);
  await page.evaluate(() => {
    window.addEventListener('monetization', monetizationCallback);
  });

  await test.step('check continuous payments do not go through', async () => {
    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: false,
    });

    await page
      .getByLabel('Wallet address/Payment pointer')
      .fill(walletAddressUrl);
    await page.getByRole('button', { name: 'Add monetization link' }).click();

    await expect(page.locator('link[rel=monetization]')).toHaveAttribute(
      'href',
      walletAddressUrl,
    );

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

    await page.evaluate(() => {
      addEventListener('monetization', monetizationCallback, { once: true });
    });

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
