import { describe, expect, test, vi } from 'vitest';
import type { Browser } from '@/shared/browser';
import { success } from '@/shared/messages';
import { ContentMessageManager } from '@/content/services/contentMessageManager';

function createBrowser(sendMessage = vi.fn()) {
  const runtime: { id?: string; sendMessage: typeof sendMessage } = {
    id: 'extension-id',
    sendMessage,
  };
  return { browser: { runtime } as unknown as Browser, runtime };
}

describe('ContentMessageManager', () => {
  test('sends messages while the extension context is valid', async () => {
    const { browser, runtime } = createBrowser(
      vi.fn().mockResolvedValue(success(undefined)),
    );
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);

    const res = await message.send('TAB_FOCUSED');

    expect(res).toEqual(success(undefined));
    expect(runtime.sendMessage).toHaveBeenCalledWith({
      action: 'TAB_FOCUSED',
      payload: undefined,
    });
    expect(message.isContextValid).toBe(true);
    expect(onInvalidated).not.toHaveBeenCalled();
  });

  test('reports a failure instead of throwing once the runtime is gone', async () => {
    const { browser, runtime } = createBrowser();
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);

    // what Chrome does to an old content script after an update/reload
    runtime.id = undefined;
    const res = await message.send('TAB_FOCUSED');

    expect(res.success).toBe(false);
    expect(runtime.sendMessage).not.toHaveBeenCalled();
    expect(message.isContextValid).toBe(false);
    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('treats a thrown "Extension context invalidated" as invalidation', async () => {
    const { browser } = createBrowser(
      vi.fn(() => {
        throw new Error('Extension context invalidated.');
      }),
    );
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);

    const res = await message.send('PAGE_HIDE');

    expect(res.success).toBe(false);
    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('treats a missing runtime as invalidation', async () => {
    const { browser } = createBrowser();
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);

    // what Chrome does to an old content script when the extension is reloaded
    (browser as { runtime?: unknown }).runtime = undefined;
    const res = await message.send('TAB_FOCUSED');

    expect(res.success).toBe(false);
    expect(message.isContextValid).toBe(false);
    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('notifies listeners only once and stops sending afterwards', async () => {
    const { browser, runtime } = createBrowser();
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);

    runtime.id = undefined;
    await message.send('TAB_FOCUSED');
    // even if the runtime looked valid again, this instance stays disconnected
    runtime.id = 'extension-id';
    await message.send('TAB_FOCUSED');

    expect(onInvalidated).toHaveBeenCalledTimes(1);
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });

  test('rethrows other errors', async () => {
    const { browser } = createBrowser(
      vi.fn().mockRejectedValue(new Error('Something else')),
    );
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);

    await expect(message.send('TAB_FOCUSED')).rejects.toThrow('Something else');
    expect(onInvalidated).not.toHaveBeenCalled();
    expect(message.isContextValid).toBe(true);
  });
});
