import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantDetails, Storage } from '@/shared/types';
import { EventsService } from '../events';
import { GrantBalanceService } from '../grantBalance';
import { makeBrowser, makeLogger, makeStorage } from './helpers';

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
