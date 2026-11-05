import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Runtime } from 'webextension-polyfill';
import {
  asBrowser,
  makeBrowser,
} from '@/background/services/__tests__/helpers';
import { CONTENT_SCRIPT_CONNECTION_NAME, success } from '@/shared/messages';
import { ContentMessageManager } from '@/content/services/contentMessageManager';

const defines = vi.hoisted(() => ({
  BUILD_TARGET: 'chrome' as 'chrome' | 'firefox' | 'safari',
}));
vi.mock('@/shared/defines', () => ({
  LOG_LEVEL: 'debug',
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
  get BUILD_TARGET() {
    return defines.BUILD_TARGET;
  },
}));

function setup() {
  const browser = makeBrowser();
  browser.runtime.sendMessage.mockResolvedValue(success(undefined));
  const ports: {
    disconnect: ReturnType<typeof vi.fn>;
    fireDisconnect: () => void;
  }[] = [];
  browser.runtime.connect.mockImplementation(() => {
    const listeners: (() => void)[] = [];
    const port = {
      disconnect: vi.fn(),
      onDisconnect: { addListener: (l: () => void) => listeners.push(l) },
      fireDisconnect: () => {
        for (const l of listeners) l();
      },
    };
    ports.push(port);
    return port as unknown as Runtime.Port;
  });
  const message = new ContentMessageManager({ browser: asBrowser(browser) });
  const onInvalidated = vi.fn();
  message.onInvalidated(onInvalidated);
  return { browser, message, onInvalidated, ports };
}

describe('ContentMessageManager', () => {
  test('sends messages while the extension context is valid', async () => {
    const { browser, message, onInvalidated } = setup();

    const res = await message.send('TAB_FOCUSED');

    expect(res).toEqual(success(undefined));
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'TAB_FOCUSED',
      payload: undefined,
    });
    expect(message.isContextValid).toBe(true);
    expect(onInvalidated).not.toHaveBeenCalled();
  });

  test('reports a failure instead of throwing once the runtime is gone', async () => {
    const { browser, message, onInvalidated } = setup();

    // what Chrome does to an old content script after an update/reload
    browser.runtime.id = undefined;
    const res = await message.send('TAB_FOCUSED');

    expect(res.success).toBe(false);
    expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
    expect(message.isContextValid).toBe(false);
    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('treats a thrown "Extension context invalidated" as invalidation', async () => {
    const { browser, message, onInvalidated } = setup();
    browser.runtime.sendMessage.mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });

    const res = await message.send('PAGE_HIDE');

    expect(res.success).toBe(false);
    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('treats a missing runtime as invalidation', async () => {
    const { browser, message, onInvalidated } = setup();

    // what Chrome does to an old content script when the extension is reloaded
    (browser as { runtime?: unknown }).runtime = undefined;
    const res = await message.send('TAB_FOCUSED');

    expect(res.success).toBe(false);
    expect(message.isContextValid).toBe(false);
    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('notifies listeners only once and stops sending afterwards', async () => {
    const { browser, message, onInvalidated } = setup();

    browser.runtime.id = undefined;
    await message.send('TAB_FOCUSED');
    // even if the runtime looked valid again, this instance stays disconnected
    browser.runtime.id = 'ext-id';
    await message.send('TAB_FOCUSED');

    expect(onInvalidated).toHaveBeenCalledTimes(1);
    expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
  });

  test('rethrows other errors', async () => {
    const { browser, message, onInvalidated } = setup();
    browser.runtime.sendMessage.mockRejectedValue(new Error('Something else'));

    await expect(message.send('TAB_FOCUSED')).rejects.toThrow('Something else');
    expect(onInvalidated).not.toHaveBeenCalled();
    expect(message.isContextValid).toBe(true);
  });
});

describe('ContentMessageManager connection watch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    defines.BUILD_TARGET = 'chrome';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('opens a port to the background', () => {
    const { browser, message } = setup();

    message.watchConnection();

    expect(browser.runtime.connect).toHaveBeenCalledTimes(1);
    expect(browser.runtime.connect).toHaveBeenCalledWith({
      name: CONTENT_SCRIPT_CONNECTION_NAME,
    });
  });

  test.each(['firefox', 'safari'] as const)(
    'does not open a port in %s',
    (target) => {
      defines.BUILD_TARGET = target;
      const { browser, message } = setup();

      message.watchConnection();

      expect(browser.runtime.connect).not.toHaveBeenCalled();
    },
  );

  test('invalidates when the port closes because the extension went away', async () => {
    const { browser, message, onInvalidated, ports } = setup();
    message.watchConnection();

    // disabled/reloaded: the port closes, and runtime.id goes away shortly after
    ports[0].fireDisconnect();
    await vi.advanceTimersByTimeAsync(50);
    browser.runtime.id = undefined;
    await vi.advanceTimersByTimeAsync(500);

    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('does not invalidate or reconnect when the service worker only went idle', async () => {
    const { browser, message, onInvalidated, ports } = setup();
    message.watchConnection();

    // the port also closes when the background service worker stops
    ports[0].fireDisconnect();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(onInvalidated).not.toHaveBeenCalled();
    expect(message.isContextValid).toBe(true);
    // reconnecting right away would wake the service worker up again
    expect(browser.runtime.connect).toHaveBeenCalledTimes(1);
  });

  test('reopens the port after the next message reaches the background', async () => {
    const { browser, message, ports } = setup();
    message.watchConnection();
    ports[0].fireDisconnect();
    await vi.advanceTimersByTimeAsync(10_000);

    await message.send('TAB_FOCUSED');

    expect(browser.runtime.connect).toHaveBeenCalledTimes(2);
    // a second message while the port is open doesn't open another one
    await message.send('TAB_FOCUSED');
    expect(browser.runtime.connect).toHaveBeenCalledTimes(2);
  });

  test('invalidates when the port cannot be opened because the context is gone', () => {
    const { browser, message, onInvalidated } = setup();
    browser.runtime.connect.mockImplementation(() => {
      browser.runtime.id = undefined;
      throw new Error('Extension context invalidated.');
    });

    message.watchConnection();

    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });

  test('disconnect() closes the port and stops watching', async () => {
    const { browser, message, ports } = setup();
    message.watchConnection();

    message.disconnect();
    await message.send('TAB_FOCUSED');

    expect(ports[0].disconnect).toHaveBeenCalledTimes(1);
    expect(browser.runtime.connect).toHaveBeenCalledTimes(1);
  });
});
