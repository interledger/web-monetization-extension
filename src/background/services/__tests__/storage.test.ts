import { describe, expect, it, vi } from 'vitest';
import type { Browser } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';
import { StorageService } from '../storage';

describe('setState', () => {
  it('keeps existing state flags when background restarts', async () => {
    const data: Record<string, unknown> = { state: { key_revoked: true } };
    const browser = {
      storage: {
        local: {
          get: vi.fn(async () => ({ state: data.state })),
          set: vi.fn(async (d: Record<string, unknown>) => {
            Object.assign(data, d);
          }),
        },
      },
    } as unknown as Browser;
    const events = { emit: vi.fn() };
    const storage = new StorageService({
      browser,
      events,
    } as unknown as Cradle);

    await storage.setState({ missing_host_permissions: false });

    expect(data.state).toEqual({
      key_revoked: true,
      missing_host_permissions: false,
    });
  });
});
