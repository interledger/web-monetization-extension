import { test, expect } from './fixtures/connected';
import {
  getLastCallArg,
  playgroundUrl,
  setupPlayground,
  interceptPaymentCreateRequests,
} from './helpers/common';
import { sendOneTimePayment } from './pages/popup';

test.afterEach(({ context }) => {
  context.removeAllListeners('requestfinished');
});

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

test.describe('should not pay immediately when overpaying', () => {
  test('on page reload', async ({ page, popup, context }) => {
    const { outgoingPaymentCreatedCallback } =
      interceptPaymentCreateRequests(context);

    const monetizationCallback = await setupPlayground(page, walletAddressUrl);

    await expect(
      popup.getByTestId('home-page'),
      'site is shown as monetized',
    ).toBeVisible();
    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(1);

    await page.reload();
    await expect(popup.getByTestId('home-page')).toBeVisible();
    await page.waitForTimeout(3000);
    await expect(
      popup.getByTestId('home-page'),
      'site is shown as monetized',
    ).toBeVisible();
    await expect(
      monetizationCallback,
      'overpaying monetization event should be fired immediately',
    ).toHaveBeenCalledTimes(2);
    await expect(
      outgoingPaymentCreatedCallback,
      'no new outgoing payment should be created',
    ).toHaveBeenCalledTimes(1);

    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      incomingPayment: outgoingPaymentCreatedCallback.calls[0][0].receiver,
    });
    expect(monetizationCallback.calls[0][0].incomingPayment).toBe(
      monetizationCallback.calls[1][0].incomingPayment,
    );

    await sendOneTimePayment(popup, '0.49');
    await page.waitForTimeout(2000);
    await expect(monetizationCallback).toHaveBeenCalledTimes(3);
    await expect(
      outgoingPaymentCreatedCallback,
      'a single new outgoing payment should be created',
    ).toHaveBeenCalledTimes(2);
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      incomingPayment: getLastCallArg(outgoingPaymentCreatedCallback).receiver,
      amountSent: {
        value: expect.stringMatching(/^0.4\d$/),
      },
    });
  });

  test('on page navigation - URL param change', async ({
    page,
    popup,
    context,
  }) => {
    const homePage = popup.getByTestId('home-page');
    const { outgoingPaymentCreatedCallback, incomingPaymentCreatedCallback } =
      interceptPaymentCreateRequests(context);

    const monetizationCallback = await setupPlayground(page, walletAddressUrl);

    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(1);
    await expect(incomingPaymentCreatedCallback).toHaveBeenCalledTimes(1);
    await expect(homePage, 'site is shown as monetized').toBeVisible();

    const url = new URL(page.url());
    url.searchParams.append('foo', 'bar');
    await page.goto(url.href);
    await expect(monetizationCallback).toHaveBeenCalledTimes(2);
    await page.waitForTimeout(3000);
    await expect(
      outgoingPaymentCreatedCallback,
      'no new outgoing payment should be created',
    ).toHaveBeenCalledTimes(1);
    await expect(
      incomingPaymentCreatedCallback,
      'new incoming payment is created',
    ).toHaveBeenCalledTimes(2);
    await expect(homePage, 'site is shown as monetized').toBeVisible();

    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      incomingPayment: getLastCallArg(outgoingPaymentCreatedCallback).receiver,
    });
    expect(monetizationCallback.calls[0][0].incomingPayment).toBe(
      monetizationCallback.calls[1][0].incomingPayment,
    );

    await sendOneTimePayment(popup, '0.49');
    await page.waitForTimeout(2000);
    await expect(monetizationCallback).toHaveBeenCalledTimes(3);
    await expect(
      outgoingPaymentCreatedCallback,
      'a single new outgoing payment should be created',
    ).toHaveBeenCalledTimes(2);
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      incomingPayment: getLastCallArg(outgoingPaymentCreatedCallback).receiver,
      amountSent: {
        value: expect.stringMatching(/^0.4\d$/),
      },
    });
    await expect(
      incomingPaymentCreatedCallback,
      'new incoming payment should be created',
    ).toHaveBeenCalledTimes(3);
  });

  test('on URL hash change', async ({ page, popup, context }) => {
    const homePage = popup.getByTestId('home-page');
    const { outgoingPaymentCreatedCallback, incomingPaymentCreatedCallback } =
      interceptPaymentCreateRequests(context);

    const monetizationCallback = await setupPlayground(page, walletAddressUrl);
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#foo';
      a.textContent = 'Hash link';
      document.body.append(a);
    });

    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(1);
    await expect(incomingPaymentCreatedCallback).toHaveBeenCalledTimes(1);
    await expect(homePage, 'site is shown as monetized').toBeVisible();

    await page.getByRole('link', { name: 'Hash link' }).click();
    await expect(page).toHaveURL(/#foo$/);
    await expect(homePage, 'site is shown as monetized').toBeVisible();
    await expect(monetizationCallback).toHaveBeenCalledTimes(1);

    await page.waitForTimeout(3000);
    await expect(
      outgoingPaymentCreatedCallback,
      'no new outgoing payment should be created',
    ).toHaveBeenCalledTimes(1);
    await expect(
      incomingPaymentCreatedCallback,
      'same incoming payment is reused',
    ).toHaveBeenCalledTimes(1);
    await expect(homePage, 'site is shown as monetized').toBeVisible();

    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      incomingPayment: getLastCallArg(outgoingPaymentCreatedCallback).receiver,
    });

    await sendOneTimePayment(popup, '0.49');
    await page.waitForTimeout(2000);
    await expect(monetizationCallback).toHaveBeenCalledTimes(2);
    await expect(
      outgoingPaymentCreatedCallback,
      'a single new outgoing payment should be created',
    ).toHaveBeenCalledTimes(2);
    await expect(
      incomingPaymentCreatedCallback,
      'new incoming payment should be created',
    ).toHaveBeenCalledTimes(2);
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      incomingPayment: getLastCallArg(outgoingPaymentCreatedCallback).receiver,
      amountSent: {
        value: expect.stringMatching(/^0.4\d$/),
      },
    });
  });
});

test('should pay immediately on page navigation (clears overpaying)', async ({
  page,
  popup,
  context,
}) => {
  const { outgoingPaymentCreatedCallback } =
    interceptPaymentCreateRequests(context);

  const monetizationCallback = await setupPlayground(page, walletAddressUrl);
  await expect(monetizationCallback).toHaveBeenCalledTimes(1);
  await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(1);
  await expect(
    popup.getByTestId('home-page'),
    'site is shown as monetized',
  ).toBeVisible();

  await page.goto('https://example.com');
  await expect(monetizationCallback).toHaveBeenCalledTimes(1);
  await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(1);
  await expect(
    popup.getByTestId('home-page'),
    'site is shown as not monetized',
  ).not.toBeVisible();

  await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
    incomingPayment: outgoingPaymentCreatedCallback.calls[0][0].receiver,
  });

  await page.goto(playgroundUrl(walletAddressUrl));
  await expect(popup.getByTestId('home-page')).toBeVisible();
  await expect(monetizationCallback).toHaveBeenCalledTimes(2);
  await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(2);
  await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
    incomingPayment: outgoingPaymentCreatedCallback.calls[1][0].receiver,
  });
  expect(monetizationCallback.calls[0][0].incomingPayment).not.toBe(
    monetizationCallback.calls[1][0].incomingPayment,
  );

  await sendOneTimePayment(popup, '0.49');
  await page.waitForTimeout(2000);
  await expect(monetizationCallback).toHaveBeenCalledTimes(3);
  await expect(
    outgoingPaymentCreatedCallback,
    'a single new outgoing payment should be created',
  ).toHaveBeenCalledTimes(3);
  await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
    incomingPayment: getLastCallArg(outgoingPaymentCreatedCallback).receiver,
    amountSent: {
      value: expect.stringMatching(/^0.4\d$/),
    },
  });
});
