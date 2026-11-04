import { JSDOM } from 'jsdom';
import { describe, expect, test, vi } from 'vitest';
import type { Browser } from '@/shared/browser';
import type { Logger } from '@/shared/logger';
import type { Cradle } from '@/content/container';
import { ContentScript } from '@/content/services/contentScript';
import { ContentMessageManager } from '@/content/services/contentMessageManager';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

function createDocument() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body></body></html>',
  );
  return {
    window: dom.window as unknown as Window,
    document: dom.window.document,
  };
}

/** A content script instance, as one injected by one extension "lifetime". */
function createContentScript({
  window,
  document,
}: ReturnType<typeof createDocument>) {
  const port = {
    disconnect: vi.fn(),
    onDisconnect: { addListener: vi.fn() },
  };
  const runtime: {
    id?: string;
    sendMessage: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
  } = {
    id: 'extension-id',
    sendMessage: vi.fn(),
    connect: vi.fn(() => port),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  };
  const browser = { runtime } as unknown as Browser;
  const message = new ContentMessageManager({ browser });
  const monetizationLinkManager = {
    start: vi.fn(),
    end: vi.fn(),
  } as unknown as Cradle['monetizationLinkManager'];
  const frameManager = {
    start: vi.fn(),
    end: vi.fn(),
  } as unknown as Cradle['frameManager'];

  const contentScript = new ContentScript({
    browser,
    window,
    global: window,
    document,
    logger,
    message,
    monetizationLinkManager,
    frameManager,
  } as unknown as Cradle);

  return {
    contentScript,
    runtime,
    port,
    message,
    monetizationLinkManager,
    frameManager,
  };
}

describe('ContentScript', () => {
  test('tears down once the extension context is invalidated', async () => {
    const env = createDocument();
    const cs = createContentScript(env);
    await cs.contentScript.start();
    const onMessageListener = cs.runtime.onMessage.addListener.mock.calls[0][0];

    // the extension was updated/reloaded/disabled
    cs.runtime.id = undefined;
    await cs.message.send('TAB_FOCUSED');
    await cs.message.send('PAGE_HIDE');

    expect(cs.monetizationLinkManager.end).toHaveBeenCalledTimes(1);
    expect(cs.frameManager.end).toHaveBeenCalledTimes(1);
    expect(cs.runtime.onMessage.removeListener).toHaveBeenCalledWith(
      onMessageListener,
    );
  });

  test('stops an old instance with an invalidated context when a new one starts', async () => {
    const env = createDocument();
    const old = createContentScript(env);
    await old.contentScript.start();

    old.runtime.id = undefined;
    const current = createContentScript(env);
    await current.contentScript.start();

    expect(old.monetizationLinkManager.end).toHaveBeenCalledTimes(1);
    expect(old.frameManager.end).toHaveBeenCalledTimes(1);
    expect(current.monetizationLinkManager.end).not.toHaveBeenCalled();
    expect(current.monetizationLinkManager.start).toHaveBeenCalledTimes(1);
  });

  test('does not start a second instance while a working one is running', async () => {
    const env = createDocument();
    const first = createContentScript(env);
    await first.contentScript.start();

    // e.g. injected after a browser update, while the first one still works
    const second = createContentScript(env);
    await second.contentScript.start();

    expect(first.monetizationLinkManager.end).not.toHaveBeenCalled();
    expect(first.frameManager.end).not.toHaveBeenCalled();
    expect(second.monetizationLinkManager.start).not.toHaveBeenCalled();
    expect(second.frameManager.start).not.toHaveBeenCalled();
    const secondListener =
      second.runtime.onMessage.addListener.mock.calls[0][0];
    expect(second.runtime.onMessage.removeListener).toHaveBeenCalledWith(
      secondListener,
    );
  });

  test('starts normally when it is the only instance', async () => {
    const env = createDocument();
    const only = createContentScript(env);
    await only.contentScript.start();

    expect(only.monetizationLinkManager.start).toHaveBeenCalledTimes(1);
    expect(only.frameManager.start).toHaveBeenCalledTimes(1);
    expect(only.monetizationLinkManager.end).not.toHaveBeenCalled();
  });

  test('watches its connection to the extension once started, and closes it when stopped', async () => {
    const env = createDocument();
    const cs = createContentScript(env);
    await cs.contentScript.start();

    expect(cs.runtime.connect).toHaveBeenCalledTimes(1);

    cs.contentScript.stop();
    expect(cs.port.disconnect).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['hidden', false],
    ['visible', true],
  ] as const)(
    'answers IS_TAB_IN_VIEW from its own document (%s)',
    async (visibilityState, inView) => {
      const env = createDocument();
      const cs = createContentScript(env);
      vi.spyOn(env.document, 'visibilityState', 'get').mockReturnValue(
        visibilityState,
      );
      const onMessage = cs.runtime.onMessage.addListener.mock.calls[0][0];

      const res = await onMessage({ action: 'IS_TAB_IN_VIEW' });

      expect(res).toEqual({ success: true, payload: inView });
    },
  );
});
