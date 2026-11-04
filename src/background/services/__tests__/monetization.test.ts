import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cradle } from '@/background/container';
import { MonetizationService } from '../monetization';

const payload = [
  {
    requestId: 'request-id',
    walletAddress: {
      id: 'https://wallet.example/alice',
      url: 'https://wallet.example/alice',
      assetCode: 'USD',
      assetScale: 2,
      authServer: 'https://wallet.example',
      resourceServer: 'https://wallet.example',
    },
  },
];

const createService = () => {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  };
  const storage = { get: vi.fn().mockResolvedValue({}) };
  const events = { on: vi.fn(), once: vi.fn() };
  const service = new MonetizationService({
    events,
    logger,
    storage,
  } as unknown as Cradle);

  return { logger, service, storage };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MonetizationService', () => {
  it('skips extension payment sessions when the browser monetization API is available', async () => {
    vi.stubGlobal('chrome', { monetization: { onPayment: {} } });
    const { logger, service, storage } = createService();

    await service.startPaymentSession(payload, {});

    expect(storage.get).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Browser handles monetization natively. Skipping extension payment session.',
    );
  });

  it('checks payment configuration when native monetization is unavailable', async () => {
    vi.stubGlobal('chrome', {});
    const { logger, service, storage } = createService();

    await service.startPaymentSession(payload, {});

    expect(storage.get).toHaveBeenCalledWith([
      'connected',
      'rateOfPay',
      'walletAddress',
    ]);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
