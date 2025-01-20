import { spy } from 'tinyspy';
import { test, expect } from './fixtures/connected';
import {
  getLastCallArg,
  playgroundUrl,
  setupPlayground,
} from './helpers/common';
import { sendOneTimePayment } from './pages/popup';
import type { OutgoingPayment } from '@interledger/open-payments';

test.beforeEach(async ({ popup }) => {
  await popup.reload();
});

test.afterEach(({ persistentContext: context }) => {
  context.removeAllListeners('requestfinished');
});

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

test('should not pay immediately on page reload (overpaying)', async ({
  page,
  popup,
  persistentContext: context,
}) => {
  const outgoingPaymentCreatedCallback = spy<
    [{ id: string; receiver: string }],
    void
  >();
  context.on('requestfinished', async function intercept(req) {
    if (!req.serviceWorker()) return;
    if (req.method() !== 'POST') return;
    if (!req.url().endsWith('/outgoing-payments')) return;

    const res = await req.response();
    if (!res) {
      throw new Error('no response from POST /outgoing-payments');
    }
    const outgoingPayment: OutgoingPayment = await res.json();

    outgoingPaymentCreatedCallback({
      id: outgoingPayment.id,
      receiver: outgoingPayment.receiver,
    });
  });

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

test('should pay immediately on page navigation (clears overpaying)', async ({
  page,
  popup,
  persistentContext: context,
}) => {
  const outgoingPaymentCreatedCallback = spy<
    [{ id: string; receiver: string }],
    void
  >();
  context.on('requestfinished', async function intercept(req) {
    if (!req.serviceWorker()) return;
    if (req.method() !== 'POST') return;
    if (!req.url().endsWith('/outgoing-payments')) return;

    const res = await req.response();
    if (!res) {
      throw new Error('no response from POST /outgoing-payments');
    }
    const outgoingPayment: OutgoingPayment = await res.json();

    outgoingPaymentCreatedCallback({
      id: outgoingPayment.id,
      receiver: outgoingPayment.receiver,
    });
  });

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

test('should not pay immediately on page navigation - URL param change (overpaying)', async ({
  page,
  popup,
  persistentContext: context,
}) => {
  const outgoingPaymentCreatedCallback = spy<
    [{ id: string; receiver: string }],
    void
  >();
  context.on('requestfinished', async function intercept(req) {
    if (!req.serviceWorker()) return;
    if (req.method() !== 'POST') return;
    if (!req.url().endsWith('/outgoing-payments')) return;

    const res = await req.response();
    if (!res) {
      throw new Error('no response from POST /outgoing-payments');
    }
    const outgoingPayment: OutgoingPayment = await res.json();

    outgoingPaymentCreatedCallback({
      id: outgoingPayment.id,
      receiver: outgoingPayment.receiver,
    });
  });

  const monetizationCallback = await setupPlayground(page, walletAddressUrl);

  await expect(monetizationCallback).toHaveBeenCalledTimes(1);
  await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(1);
  await expect(
    popup.getByTestId('home-page'),
    'site is shown as monetized',
  ).toBeVisible();

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
    popup.getByTestId('home-page'),
    'site is shown as monetized',
  ).toBeVisible();

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
});
