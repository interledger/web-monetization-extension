import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenPaymentsClientError } from '@interledger/open-payments';
import { BACKGROUND_TO_POPUP_CONNECTION_NAME } from '@/shared/messages';
import type { GrantDetails, Storage } from '@/shared/types';
import { EventsService } from '../events';
import {
  GrantBalanceService,
  GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM,
  GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_INTERVAL_MS,
} from '../grantBalance';
import { makeBrowser, makeLogger, makeStorage, walletInfo } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeService(
  overrides: {
    isAnyGrantUsable?: boolean;
    grantType?: 'recurring' | 'one-time';
    storageState?: Partial<Storage>;
  } = {},
) {
  const storage = makeStorage(overrides.storageState);
  const browser = makeBrowser();
  const events = new EventsService();
  const logger = makeLogger();
  const outgoingPaymentGrantService = {
    grantType: overrides.grantType ?? 'recurring',
    isAnyGrantUsable: overrides.isAnyGrantUsable ?? false,
    getGrantSpentAmounts: vi.fn(),
  };
  const service = new GrantBalanceService({
    storage,
    logger,
    events,
    outgoingPaymentGrantService,
    browser,
  } as unknown as ConstructorParameters<typeof GrantBalanceService>[0]);
  return {
    service,
    storage,
    browser,
    events,
    outgoingPaymentGrantService,
  };
}

function makePort(name: string) {
  const disconnectListeners: Array<() => void> = [];
  return {
    name,
    error: undefined,
    onDisconnect: {
      addListener: (cb: () => void) => disconnectListeners.push(cb),
      removeListener: vi.fn(),
    },
    disconnect: () => {
      for (const cb of disconnectListeners) cb();
    },
  };
}

describe('open_payments.outgoing_payment_created event handling', () => {
  async function emitOutgoingPaymentCreated(
    events: EventsService,
    amount: string,
    grantType: GrantDetails['type'],
  ) {
    events.emit('open_payments.outgoing_payment_created', {
      debitAmount: { value: amount, assetCode: 'USD', assetScale: 2 },
      grantType,
    });
  }

  it('adds amount to the recurring grant spent amount', async () => {
    const grantType = 'recurring';
    const { service, storage, events } = makeService({
      grantType,
      storageState: { recurringGrantSpentAmount: '100' },
    });
    service.start();

    await emitOutgoingPaymentCreated(events, '25', grantType);
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.setSpentAmount).toHaveBeenCalledWith(grantType, '125');
  });

  it('adds amount to the one-time grant spent amount', async () => {
    const grantType = 'one-time';
    const { service, storage, events } = makeService({
      grantType,
      storageState: { oneTimeGrantSpentAmount: '50' },
    });
    service.start();

    await emitOutgoingPaymentCreated(events, '10', grantType);
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.setSpentAmount).toHaveBeenCalledWith(grantType, '60');
  });

  it('accumulates correctly across multiple sequential emits', async () => {
    const grantType = 'recurring';
    const { service, storage, events } = makeService({
      grantType,
      storageState: { recurringGrantSpentAmount: '0' },
    });
    service.start();

    await emitOutgoingPaymentCreated(events, '10', grantType);
    await emitOutgoingPaymentCreated(events, '5', grantType);
    await emitOutgoingPaymentCreated(events, '-3', grantType);
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.setSpentAmount).toHaveBeenLastCalledWith(grantType, '12');
    expect(
      (await storage.get(['recurringGrantSpentAmount']))
        .recurringGrantSpentAmount,
    ).toBe('12');
  });

  it('accumulates both amounts when two payments to multiple receivers complete within the same throttle window', async () => {
    const grantType = 'recurring';
    const { service, storage, events } = makeService({
      grantType,
      storageState: { recurringGrantSpentAmount: '0' },
    });
    service.start();

    events.emit('open_payments.outgoing_payment_created', {
      debitAmount: { value: '25', assetCode: 'USD', assetScale: 2 },
      grantType,
    });
    await vi.advanceTimersByTimeAsync(100);
    events.emit('open_payments.outgoing_payment_created', {
      debitAmount: { value: '25', assetCode: 'USD', assetScale: 2 },
      grantType,
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.setSpentAmount).toHaveBeenLastCalledWith(grantType, '50');
    await expect(storage.get(['recurringGrantSpentAmount'])).resolves.toEqual({
      recurringGrantSpentAmount: '50',
    });
  });
});

describe('open_payments.outgoing_payment_completed event handling', () => {
  async function emitOutgoingPaymentCompleted(
    events: EventsService,
    {
      debitAmountValue,
      sentAmountValue,
      status,
      grantType,
    }: {
      debitAmountValue: string;
      sentAmountValue: string;
      status: 'failed' | 'succeeded';
      grantType: GrantDetails['type'];
    },
  ) {
    events.emit('open_payments.outgoing_payment_completed', {
      debitAmount: { value: debitAmountValue, assetCode: 'USD', assetScale: 2 },
      sentAmount: { value: sentAmountValue, assetCode: 'USD', assetScale: 2 },
      status,
      grantType,
    });
  }

  it('subtracts amount from the recurring grant spent amount', async () => {
    const grantType = 'recurring';
    const { service, storage, events } = makeService({
      grantType,
      storageState: { recurringGrantSpentAmount: '100' },
    });
    service.start();

    await emitOutgoingPaymentCompleted(events, {
      debitAmountValue: '25',
      sentAmountValue: '25',
      status: 'failed',
      grantType,
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.setSpentAmount).toHaveBeenCalledWith(grantType, '75');
  });

  it('subtracts amount from the one-time grant spent amount', async () => {
    const grantType = 'one-time';
    const { service, storage, events } = makeService({
      grantType,
      storageState: { oneTimeGrantSpentAmount: '50' },
    });
    service.start();

    await emitOutgoingPaymentCompleted(events, {
      debitAmountValue: '25',
      sentAmountValue: '25',
      status: 'failed',
      grantType,
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.setSpentAmount).toHaveBeenCalledWith(grantType, '25');
  });

  it('accumulates correctly across multiple sequential emits', async () => {
    const grantType = 'recurring';
    const { service, storage, events } = makeService({
      grantType,
      storageState: { recurringGrantSpentAmount: '100' },
    });
    service.start();

    await emitOutgoingPaymentCompleted(events, {
      debitAmountValue: '25',
      sentAmountValue: '25',
      status: 'failed',
      grantType,
    });
    await emitOutgoingPaymentCompleted(events, {
      debitAmountValue: '5',
      sentAmountValue: '5',
      status: 'failed',
      grantType,
    });
    await emitOutgoingPaymentCompleted(events, {
      debitAmountValue: '3',
      sentAmountValue: '3',
      status: 'failed',
      grantType,
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.setSpentAmount).toHaveBeenLastCalledWith(grantType, '67');
    expect(
      (await storage.get(['recurringGrantSpentAmount']))
        .recurringGrantSpentAmount,
    ).toBe('67');
  });

  it('subtracts amount if not full amount was sent', async () => {
    const grantType = 'recurring';
    const { service, storage, events } = makeService({
      grantType,
      storageState: { recurringGrantSpentAmount: '100' },
    });
    service.start();

    await emitOutgoingPaymentCompleted(events, {
      debitAmountValue: '25',
      sentAmountValue: '10',
      status: 'failed',
      grantType,
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.setSpentAmount).toHaveBeenCalledWith(grantType, '85');
  });
});

describe('checkGrantSpentAmountsSupport (via start())', () => {
  it('does nothing when no grant is usable', async () => {
    const { service, browser, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: false,
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      outgoingPaymentGrantService.getGrantSpentAmounts,
    ).not.toHaveBeenCalled();
    expect(browser.alarms.create).not.toHaveBeenCalled();
  });

  it('skips the check when support is already confirmed', async () => {
    const { service, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: true,
      storageState: {
        walletAddress: walletInfo,
        supportsGrantSpentAmounts: { supported: true, lastCheckedAt: 123 },
      },
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      outgoingPaymentGrantService.getGrantSpentAmounts,
    ).not.toHaveBeenCalled();
  });

  it('skips the check when there is no connected wallet', async () => {
    const { service, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: true,
      storageState: { walletAddress: null },
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      outgoingPaymentGrantService.getGrantSpentAmounts,
    ).not.toHaveBeenCalled();
  });

  it('marks support as confirmed and schedules a recheck alarm on success', async () => {
    const { service, storage, browser, outgoingPaymentGrantService } =
      makeService({
        isAnyGrantUsable: true,
        storageState: { walletAddress: walletInfo },
      });
    outgoingPaymentGrantService.getGrantSpentAmounts.mockResolvedValue({
      spentDebitAmount: { value: '5', assetCode: 'USD', assetScale: 2 },
      spentReceiveAmount: null,
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      (await storage.get(['supportsGrantSpentAmounts']))
        .supportsGrantSpentAmounts,
    ).toEqual({
      supported: true,
      lastCheckedAt: expect.any(Number),
    });
    expect(browser.alarms.create).toHaveBeenCalledWith(
      GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM,
      expect.objectContaining({
        periodInMinutes:
          GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_INTERVAL_MS / 60 / 1000,
      }),
    );
  });

  it('does not create a duplicate recheck alarm if one already exists', async () => {
    const { service, browser, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: true,
      storageState: { walletAddress: walletInfo },
    });
    browser.alarms.get.mockResolvedValue({
      name: GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM,
    });
    outgoingPaymentGrantService.getGrantSpentAmounts.mockResolvedValue({
      spentDebitAmount: { value: '5', assetCode: 'USD', assetScale: 2 },
      spentReceiveAmount: null,
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(browser.alarms.create).not.toHaveBeenCalled();
  });

  it('marks support as unsupported on a 404 error', async () => {
    const { service, storage, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: true,
      storageState: { walletAddress: walletInfo },
    });
    outgoingPaymentGrantService.getGrantSpentAmounts.mockRejectedValue(
      new OpenPaymentsClientError('not found', {
        description: 'not found',
        status: 404,
      }),
    );

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      (await storage.get(['supportsGrantSpentAmounts']))
        .supportsGrantSpentAmounts,
    ).toEqual({
      supported: false,
      lastCheckedAt: expect.any(Number),
    });
  });

  it('preserves prior support state on a non-404 error', async () => {
    const { service, storage, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: true,
      storageState: {
        walletAddress: walletInfo,
        supportsGrantSpentAmounts: { supported: false, lastCheckedAt: 1 },
      },
    });
    outgoingPaymentGrantService.getGrantSpentAmounts.mockRejectedValue(
      new Error('oh no!'),
    );

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      (await storage.get(['supportsGrantSpentAmounts']))
        .supportsGrantSpentAmounts,
    ).toEqual({
      supported: false,
      lastCheckedAt: expect.any(Number),
    });
  });
});

describe('alarm recheck listener', () => {
  it('ignores alarms with a different name', async () => {
    const { service, browser, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: false,
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    const [listener] = browser.alarms.onAlarm.addListener.mock.calls[0];
    await listener({ name: 'some-other-alarm' });

    expect(
      outgoingPaymentGrantService.getGrantSpentAmounts,
    ).not.toHaveBeenCalled();
  });

  it('re-checks support and clears the alarm when it fires and support is confirmed', async () => {
    const { service, browser, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: false,
      storageState: { walletAddress: walletInfo },
    });
    outgoingPaymentGrantService.getGrantSpentAmounts.mockResolvedValue({
      spentDebitAmount: { value: '5', assetCode: 'USD', assetScale: 2 },
      spentReceiveAmount: null,
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    outgoingPaymentGrantService.isAnyGrantUsable = true;
    const [listener] = browser.alarms.onAlarm.addListener.mock.calls[0];
    await listener({ name: GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM });
    await vi.advanceTimersByTimeAsync(0);

    expect(browser.alarms.clear).toHaveBeenCalledWith(
      GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM,
    );
  });

  it('does not clear the alarm when support is still not confirmed', async () => {
    const { service, browser, outgoingPaymentGrantService } = makeService({
      isAnyGrantUsable: false,
      storageState: { walletAddress: walletInfo },
    });
    outgoingPaymentGrantService.getGrantSpentAmounts.mockRejectedValue(
      new OpenPaymentsClientError('not found', {
        description: 'not found',
        status: 404,
      }),
    );

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    outgoingPaymentGrantService.isAnyGrantUsable = true;
    const [listener] = browser.alarms.onAlarm.addListener.mock.calls[0];
    await listener({ name: GRANT_SPENT_AMOUNTS_SUPPORT_RECHECK_ALARM });
    await vi.advanceTimersByTimeAsync(0);

    expect(browser.alarms.clear).not.toHaveBeenCalled();
  });
});

describe('registerBalanceUpdateHandler / saveUpdatedBalance', () => {
  it('does not register a popup-open balance refresh handler when support is unknown', async () => {
    const { service, browser } = makeService({
      isAnyGrantUsable: false,
      storageState: {},
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(browser.runtime.onConnect.addListener).not.toHaveBeenCalled();
  });

  it('updates the spent amount when the popup connects and support is confirmed', async () => {
    const { service, storage, browser, outgoingPaymentGrantService } =
      makeService({
        isAnyGrantUsable: false,
        grantType: 'recurring',
        storageState: {
          supportsGrantSpentAmounts: { supported: true, lastCheckedAt: 1 },
          walletAddress: walletInfo,
          continuousPaymentsEnabled: true,
        },
      });
    outgoingPaymentGrantService.getGrantSpentAmounts.mockResolvedValue({
      spentDebitAmount: { value: '42', assetCode: 'USD', assetScale: 2 },
      spentReceiveAmount: null,
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);
    const [listener] = browser.runtime.onConnect.addListener.mock.calls[0];
    listener(makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME));
    await vi.advanceTimersByTimeAsync(0);

    expect(storage.setSpentAmount).toHaveBeenCalledWith('recurring', '42');
  });

  it('does not update the balance on popup connect when there is no connected wallet', async () => {
    const { service, storage, browser, outgoingPaymentGrantService } =
      makeService({
        isAnyGrantUsable: false,
        storageState: {
          supportsGrantSpentAmounts: { supported: true, lastCheckedAt: 1 },
          walletAddress: null,
        },
      });

    service.start();
    await vi.advanceTimersByTimeAsync(0);
    const [listener] = browser.runtime.onConnect.addListener.mock.calls[0];
    listener(makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME));
    await vi.advanceTimersByTimeAsync(0);

    expect(
      outgoingPaymentGrantService.getGrantSpentAmounts,
    ).not.toHaveBeenCalled();
    expect(storage.setSpentAmount).not.toHaveBeenCalled();
  });

  it('does not update the balance when spentDebitAmount is absent', async () => {
    const { service, storage, browser, outgoingPaymentGrantService } =
      makeService({
        isAnyGrantUsable: false,
        storageState: {
          supportsGrantSpentAmounts: { supported: true, lastCheckedAt: 1 },
          walletAddress: walletInfo,
        },
      });
    outgoingPaymentGrantService.getGrantSpentAmounts.mockResolvedValue({
      spentDebitAmount: null,
      spentReceiveAmount: null,
    });

    service.start();
    await vi.advanceTimersByTimeAsync(0);
    const [listener] = browser.runtime.onConnect.addListener.mock.calls[0];
    listener(makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME));
    await vi.advanceTimersByTimeAsync(0);

    expect(storage.setSpentAmount).not.toHaveBeenCalled();
  });

  describe('recurring refresh scheduling', () => {
    it('schedules a recurring balance refresh after the popup connects', async () => {
      const { service, storage, browser, outgoingPaymentGrantService } =
        makeService({
          isAnyGrantUsable: false,
          grantType: 'recurring',
          storageState: {
            supportsGrantSpentAmounts: { supported: true, lastCheckedAt: 1 },
            walletAddress: walletInfo,
            continuousPaymentsEnabled: true,
          },
        });
      outgoingPaymentGrantService.getGrantSpentAmounts
        .mockResolvedValueOnce({
          spentDebitAmount: { value: '10', assetCode: 'USD', assetScale: 2 },
          spentReceiveAmount: null,
        })
        .mockResolvedValueOnce({
          spentDebitAmount: { value: '20', assetCode: 'USD', assetScale: 2 },
          spentReceiveAmount: null,
        });

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      const [listener] = browser.runtime.onConnect.addListener.mock.calls[0];
      listener(makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME));
      await vi.advanceTimersByTimeAsync(0);
      expect(storage.setSpentAmount).toHaveBeenNthCalledWith(
        1,
        'recurring',
        '10',
      );

      // continuousPaymentsEnabled -> refresh every 1 minute
      await vi.advanceTimersByTimeAsync(60_000);
      expect(storage.setSpentAmount).toHaveBeenNthCalledWith(
        2,
        'recurring',
        '20',
      );
    });

    it('uses a 5 minute refresh interval when continuous payments are disabled', async () => {
      const { service, storage, browser, outgoingPaymentGrantService } =
        makeService({
          isAnyGrantUsable: false,
          grantType: 'recurring',
          storageState: {
            supportsGrantSpentAmounts: { supported: true, lastCheckedAt: 1 },
            walletAddress: walletInfo,
            continuousPaymentsEnabled: false,
          },
        });
      outgoingPaymentGrantService.getGrantSpentAmounts
        .mockResolvedValueOnce({
          spentDebitAmount: { value: '10', assetCode: 'USD', assetScale: 2 },
          spentReceiveAmount: null,
        })
        .mockResolvedValueOnce({
          spentDebitAmount: { value: '20', assetCode: 'USD', assetScale: 2 },
          spentReceiveAmount: null,
        });

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      const [listener] = browser.runtime.onConnect.addListener.mock.calls[0];
      listener(makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME));
      await vi.advanceTimersByTimeAsync(0);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(storage.setSpentAmount).toHaveBeenCalledTimes(1); // not yet refreshed

      await vi.advanceTimersByTimeAsync(4 * 60_000);
      expect(storage.setSpentAmount).toHaveBeenNthCalledWith(
        2,
        'recurring',
        '20',
      );
    });

    it('clears the refresh timeout and if a scheduled update fails', async () => {
      const { service, storage, browser, outgoingPaymentGrantService } =
        makeService({
          isAnyGrantUsable: false,
          storageState: {
            supportsGrantSpentAmounts: { supported: true, lastCheckedAt: 1 },
            walletAddress: walletInfo,
            continuousPaymentsEnabled: true,
          },
        });
      outgoingPaymentGrantService.getGrantSpentAmounts
        .mockResolvedValueOnce({
          spentDebitAmount: { value: '10', assetCode: 'USD', assetScale: 2 },
          spentReceiveAmount: null,
        })
        .mockRejectedValueOnce(new Error('network down'));

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      const [listener] = browser.runtime.onConnect.addListener.mock.calls[0];
      listener(makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME));
      await vi.advanceTimersByTimeAsync(0);

      await vi.advanceTimersByTimeAsync(60_000);

      storage.setSpentAmount.mockClear();
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(storage.setSpentAmount).not.toHaveBeenCalled();
    });
  });
});
