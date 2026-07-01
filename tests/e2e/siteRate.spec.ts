import { MIN_PAYMENT_WAIT } from '@/background/config';
import { hostnameToSiteKey } from '@/background/services/rateList';
import { getResponseOrThrow, type SiteRateEntry } from '@/shared/messages';
import { test, expect } from './fixtures/connected';
import { sendBackgroundMessage } from './fixtures/helpers';
import {
  interceptPaymentCreateRequests,
  playgroundUrl,
  setupPlayground,
} from './helpers/common';
import type { AmountValue } from '@/shared/types';
import type { Popup } from './pages/popup';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
const PLAYGROUND_HOSTNAME = 'webmonetization.org';

const GLOBAL_RATE = '3600';
const SITE_RATE = '7200';

test.describe('per-site rate – storage', () => {
  test('GET_PER_SITE_RATE_OF_PAY returns empty list initially', async ({
    popup,
  }) => {
    const rates = await getSiteRates(popup);
    expect(rates).toEqual([]);
  });

  test('SET_SITE_RATE_OF_PAY stores a rate', async ({ popup }) => {
    await setSiteRate(popup, PLAYGROUND_HOSTNAME, '500');
    const rates = await getSiteRates(popup);
    expect(rates).toContainEqual({
      site: hostnameToSiteKey(PLAYGROUND_HOSTNAME),
      rate: '500',
    });
  });

  test('SET_SITE_RATE_OF_PAY overwrites existing entry', async ({ popup }) => {
    await setSiteRate(popup, PLAYGROUND_HOSTNAME, '500');
    await setSiteRate(popup, PLAYGROUND_HOSTNAME, '800');
    const rates = await getSiteRates(popup);
    const entry = rates.filter(
      (r) => r.site === hostnameToSiteKey(PLAYGROUND_HOSTNAME),
    );
    expect(entry).toHaveLength(1);
    expect(entry[0].rate).toBe('800');
  });

  test('SET_SITE_RATE_OF_PAY with rate=null deletes the entry', async ({
    popup,
  }) => {
    await setSiteRate(popup, PLAYGROUND_HOSTNAME, '500');
    await setSiteRate(popup, PLAYGROUND_HOSTNAME, null);
    const rates = await getSiteRates(popup);
    expect(
      rates.find((r) => r.site === hostnameToSiteKey(PLAYGROUND_HOSTNAME)),
    ).toBeUndefined();
  });
});

test.describe('per-site rate – GET_DATA_POPUP', () => {
  test('tab.rateOfPay is present when a site rate is active', async ({
    page,
    popup,
  }) => {
    const SITE_RATE_VAL = '500';
    await setupPlayground(page, walletAddressUrl);
    await page.bringToFront();
    await setSiteRate(popup, PLAYGROUND_HOSTNAME, SITE_RATE_VAL);

    const res = await sendBackgroundMessage(popup, 'GET_DATA_POPUP', undefined);
    const data = getResponseOrThrow(res);
    expect(data.tab.rateOfPay).toBe(SITE_RATE_VAL);
  });
});

test.describe('per-site rate – payment session', () => {
  test.beforeEach(async ({ background }) => {
    await background.evaluate(
      (rate) => chrome.storage.local.set({ rateOfPay: rate }),
      GLOBAL_RATE,
    );
  });

  test('site rate is used when a payment session starts', async ({
    page,
    context,
    popup,
  }) => {
    const { outgoingPaymentCreatedCallback } =
      interceptPaymentCreateRequests(context);

    await setSiteRate(popup, PLAYGROUND_HOSTNAME, SITE_RATE);
    await setupPlayground(page, walletAddressUrl);

    await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(1, {
      timeout: 10_000,
    });
    const siteRateDebit = Number(
      outgoingPaymentCreatedCallback.calls[0][0].debitAmount.value,
    );

    await setSiteRate(popup, PLAYGROUND_HOSTNAME, null);
    // Navigate away to destroy the PaymentManager (clears its timer),
    // then advance fake time so preventOverpaying won't block the next session.
    await page.goto('about:blank');
    await context.clock.runFor(MIN_PAYMENT_WAIT);
    await page.goto(playgroundUrl(walletAddressUrl));

    await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(2, {
      timeout: 10_000,
    });
    const globalRateDebit = Number(
      outgoingPaymentCreatedCallback.calls[1][0].debitAmount.value,
    );

    expect(siteRateDebit).toBeGreaterThan(globalRateDebit);
  });

  test('site rate change propagates to active payment session', async ({
    page,
    context,
    popup,
  }) => {
    const { outgoingPaymentCreatedCallback } =
      interceptPaymentCreateRequests(context);
    const monetizationCallback = await setupPlayground(page, walletAddressUrl);

    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    const firstDebit = Number(
      outgoingPaymentCreatedCallback.calls[0][0].debitAmount.value,
    );

    await setSiteRate(popup, PLAYGROUND_HOSTNAME, SITE_RATE);
    await context.clock.runFor(MIN_PAYMENT_WAIT);

    await expect(monetizationCallback).toHaveBeenCalledTimes(2);
    const secondDebit = Number(
      outgoingPaymentCreatedCallback.calls[1][0].debitAmount.value,
    );

    expect(secondDebit).toBeGreaterThan(firstDebit);
  });

  test('deleting site rate reverts active session to global rate', async ({
    page,
    context,
    popup,
  }) => {
    const { outgoingPaymentCreatedCallback } =
      interceptPaymentCreateRequests(context);
    const monetizationCallback = await setupPlayground(page, walletAddressUrl);

    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    const globalDebit = Number(
      outgoingPaymentCreatedCallback.calls[0][0].debitAmount.value,
    );

    await setSiteRate(popup, PLAYGROUND_HOSTNAME, SITE_RATE);
    await context.clock.runFor(MIN_PAYMENT_WAIT);
    await expect(monetizationCallback).toHaveBeenCalledTimes(2);
    const siteDebit = Number(
      outgoingPaymentCreatedCallback.calls[1][0].debitAmount.value,
    );
    expect(siteDebit).toBeGreaterThan(globalDebit);

    await setSiteRate(popup, PLAYGROUND_HOSTNAME, null);
    // Navigate away to destroy the PaymentManager (clears its timer),
    // then advance fake time so preventOverpaying won't block the next session.
    await page.goto('about:blank');
    await context.clock.runFor(MIN_PAYMENT_WAIT);
    await page.goto(playgroundUrl(walletAddressUrl));
    await expect(monetizationCallback).toHaveBeenCalledTimes(3);
    const revertedDebit = Number(
      outgoingPaymentCreatedCallback.calls[2][0].debitAmount.value,
    );
    expect(revertedDebit).toBe(globalDebit);
  });
});

// TODO: we'll use UI interactions in the future.
async function setSiteRate(
  popup: Popup,
  hostname: string,
  rate: AmountValue | null,
): Promise<void> {
  const res = await sendBackgroundMessage(popup, 'SET_SITE_RATE_OF_PAY', {
    hostname,
    rate,
  });
  getResponseOrThrow(res);
}

async function getSiteRates(popup: Popup): Promise<SiteRateEntry[]> {
  const res = await sendBackgroundMessage(
    popup,
    'GET_PER_SITE_RATE_OF_PAY',
    undefined,
  );
  return getResponseOrThrow(res);
}
