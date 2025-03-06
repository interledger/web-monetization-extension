import { test, expect, DEFAULT_BUDGET } from './fixtures/connected';
import { setupPlayground } from './helpers/common';
import {
  goToHome,
  locators,
  sendOneTimePayment,
  setContinuousPayments,
} from './pages/popup';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

test('should monetize site with single wallet address', async ({
  page,
  popup,
}) => {
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

  await goToHome(popup);
  await page.bringToFront();

  await expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();
  expect(await popup.getByRole('textbox').all()).toHaveLength(1);
});

test('does not monetize when continuous payments are disabled', async ({
  page,
  popup,
  background,
}) => {
  await test.step('disable continuous payments', async () => {
    await expect(background).toHaveStorage({ continuousPaymentsEnabled: true });
    await setContinuousPayments(popup, false);
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
    await goToHome(popup);
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
    await setContinuousPayments(popup, true);
    await goToHome(popup);

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

test('does not monetize when global payments toggle in unchecked', async ({
  page,
  popup,
  background,
  i18n,
}) => {
  const sendNowButton = popup.getByRole('button', { name: 'Send now' });

  await test.step('disables extension', async () => {
    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: true,
      enabled: true,
    });

    await popup
      .getByRole('checkbox', { name: 'Disable extension' })
      .uncheck({ force: true }); // TODO: remove force; normally this should not be necessary

    await expect(popup.getByTestId('not-monetized-message')).toHaveText(
      i18n.getMessage('app_text_disabled'),
    );
    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: true,
      enabled: false,
    });
  });

  const monetizationCallback = await setupPlayground(page, walletAddressUrl);
  const eventsLog = page.locator('#link-events ul.events');
  await expect(eventsLog).toBeVisible();
  await expect(eventsLog.locator('li')).toHaveCount(1);
  await expect(eventsLog.locator('li').last()).toContainText('Load Event');

  await test.step('check extension payments do not go through', async () => {
    await expect(sendNowButton).not.toBeVisible();
    await expect(monetizationCallback).toHaveBeenCalledTimes(0);
  });

  await test.step('and does not monetize even with continuous payments toggle on/off', async () => {
    await setContinuousPayments(popup, false);
    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: false,
      enabled: false,
    });
    await expect(monetizationCallback).toHaveBeenCalledTimes(0);

    await expect(
      popup.getByRole('tabpanel', { name: 'Rate' }).locator('p'),
    ).toContainText('Ongoing payments are now disabled');

    await goToHome(popup);
    await setContinuousPayments(popup, true);
    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: true,
      enabled: false,
    });
    await expect(monetizationCallback).toHaveBeenCalledTimes(0);
  });

  await test.step('checking global payments toggle re-enables payments in extension', async () => {
    await locators.backLink(popup).click();

    await popup
      .getByRole('checkbox', { name: 'Enable extension' })
      .check({ force: true }); // TODO: remove force; normally this should not be necessary
    await expect(sendNowButton).toBeVisible();

    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: true,
      enabled: true,
    });
    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    await expect(eventsLog.locator('li')).toHaveCount(2);
    await expect(eventsLog).toBeVisible();
  });
});

test.describe('one-time payment', () => {
  test.beforeEach(
    'disable continuous payments',
    async ({ popup, background }) => {
      await setContinuousPayments(popup, false);
      await expect(background).toHaveStorage({
        continuousPaymentsEnabled: false,
      });
      await goToHome(popup);
    },
  );

  test('should send when within budget', async ({ popup, page, i18n }) => {
    const monetizationCallback = await setupPlayground(page, walletAddressUrl);
    await expect(monetizationCallback).toHaveBeenCalledTimes(0);

    const form = popup.getByTestId('pay-form');
    await expect(form).toBeVisible();
    const alertMsg = form.getByRole('alert');

    const amountToFill = DEFAULT_BUDGET.amount / 2;
    const sendButton = await sendOneTimePayment(popup, amountToFill.toString());
    await expect(sendButton).toHaveAttribute('data-progress', 'true');
    await expect(alertMsg).not.toBeVisible();
    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    expect(monetizationCallback).toHaveLastAmountSentCloseTo(amountToFill);

    await expect(sendButton).toHaveAttribute('data-progress', 'false', {
      timeout: 10_000,
    });
    await expect(alertMsg).toBeVisible();
    await expect(alertMsg).toHaveText(i18n.getMessage('pay_state_success'));
  });

  test.describe('should not send when outside budget', () => {
    test('more than total budget', async ({ page, popup, i18n }) => {
      const monetizationCallback = await setupPlayground(
        page,
        walletAddressUrl,
      );
      await expect(monetizationCallback).toHaveBeenCalledTimes(0);

      const form = popup.getByTestId('pay-form');
      await expect(form).toBeVisible();
      const alertMsg = form.getByRole('alert');

      const amountToFill = DEFAULT_BUDGET.amount * 1.2;
      const sendButton = await sendOneTimePayment(
        popup,
        amountToFill.toString(),
      );
      await expect(sendButton).toHaveAttribute('data-progress', 'false');
      await expect(sendButton).toBeEnabled();

      await expect(alertMsg).toBeVisible();
      await expect(alertMsg).toHaveText(
        i18n.getMessage('pay_error_notEnoughFunds'),
      );

      await expect(monetizationCallback).toHaveBeenCalledTimes(0);
    });

    test('more than remaining balance', async ({ page, popup, i18n }) => {
      const monetizationCallback = await setupPlayground(
        page,
        walletAddressUrl,
      );
      await expect(monetizationCallback).toHaveBeenCalledTimes(0);

      const form = popup.getByTestId('pay-form');
      await expect(form).toBeVisible();
      const alertMsg = form.getByRole('alert');

      const amountToFill1 = 0.75 * DEFAULT_BUDGET.amount;
      await sendOneTimePayment(popup, amountToFill1.toString(), true);
      await expect(monetizationCallback).toHaveBeenCalledTimes(1);
      await expect(alertMsg).toBeVisible();
      await expect(alertMsg).toHaveText(i18n.getMessage('pay_state_success'));

      const amountToFill2 = 0.5 * DEFAULT_BUDGET.amount;
      const sendButton = await sendOneTimePayment(
        popup,
        amountToFill2.toString(),
      );

      await expect(sendButton).toHaveAttribute('data-progress', 'false');
      await expect(sendButton).toBeEnabled();

      await expect(alertMsg).toBeVisible();
      await expect(alertMsg).toHaveText(
        i18n.getMessage('pay_error_notEnoughFunds'),
      );

      await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    });
  });
});
