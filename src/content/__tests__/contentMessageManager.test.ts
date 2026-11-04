import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Browser } from '@/shared/browser';
import { CONTENT_SCRIPT_CONNECTION_NAME, success } from '@/shared/messages';
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

describe('ContentMessageManager connection watch', () => {
  function createWatchedBrowser() {
    const ports: {
      name: string;
      disconnect: ReturnType<typeof vi.fn>;
      fireDisconnect: () => void;
    }[] = [];
    const runtime: {
      id?: string;
      sendMessage: ReturnType<typeof vi.fn>;
      connect: ReturnType<typeof vi.fn>;
    } = {
      id: 'extension-id',
      sendMessage: vi.fn().mockResolvedValue(success(undefined)),
      connect: vi.fn(({ name }: { name: string }) => {
        const listeners: (() => void)[] = [];
        const port = {
          name,
          disconnect: vi.fn(),
          onDisconnect: { addListener: (l: () => void) => listeners.push(l) },
          fireDisconnect: () => {
            for (const l of listeners) l();
          },
        };
        ports.push(port);
        return port;
      }),
    };
    return { browser: { runtime } as unknown as Browser, runtime, ports };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('opens a port to the background', () => {
    const { browser, runtime } = createWatchedBrowser();
    const message = new ContentMessageManager({ browser });

    message.watchConnection();

    expect(runtime.connect).toHaveBeenCalledTimes(1);
    expect(runtime.connect).toHaveBeenCalledWith({
      name: CONTENT_SCRIPT_CONNECTION_NAME,
    });
  });

  test('invalidates when the port closes because the extension went away', async () => {
    const { browser, runtime, ports } = createWatchedBrowser();
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);
    message.watchConnection();

    // disabled/reloaded: the port closes, and runtime.id goes away shortly after
    ports[0].fireDisconnect();
    await vi.advanceTimersByTimeAsync(50);
    runtime.id = undefined;
    await vi.advanceTimersByTimeAsync(500);

    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('does not invalidate or reconnect when the service worker only went idle', async () => {
    const { browser, runtime, ports } = createWatchedBrowser();
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);
    message.watchConnection();

    // the port also closes when the background service worker stops
    ports[0].fireDisconnect();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(onInvalidated).not.toHaveBeenCalled();
    expect(message.isContextValid).toBe(true);
    // reconnecting right away would wake the service worker up again
    expect(runtime.connect).toHaveBeenCalledTimes(1);
  });

  test('reopens the port after the next message reaches the background', async () => {
    const { browser, runtime, ports } = createWatchedBrowser();
    const message = new ContentMessageManager({ browser });
    message.watchConnection();
    ports[0].fireDisconnect();
    await vi.advanceTimersByTimeAsync(10_000);

    await message.send('TAB_FOCUSED');

    expect(runtime.connect).toHaveBeenCalledTimes(2);
    // a second message while the port is open doesn't open another one
    await message.send('TAB_FOCUSED');
    expect(runtime.connect).toHaveBeenCalledTimes(2);
  });

  test('invalidates when the port cannot be opened because the context is gone', () => {
    const { browser, runtime } = createWatchedBrowser();
    runtime.connect.mockImplementation(() => {
      runtime.id = undefined;
      throw new Error('Extension context invalidated.');
    });
    const message = new ContentMessageManager({ browser });
    const onInvalidated = vi.fn();
    message.onInvalidated(onInvalidated);

    message.watchConnection();

    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('disconnect() closes the port and stops watching', async () => {
    const { browser, runtime, ports } = createWatchedBrowser();
    const message = new ContentMessageManager({ browser });
    message.watchConnection();

    message.disconnect();
    await message.send('TAB_FOCUSED');

    expect(ports[0].disconnect).toHaveBeenCalledTimes(1);
    expect(runtime.connect).toHaveBeenCalledTimes(1);
  });
});
