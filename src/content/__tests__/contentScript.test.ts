import { JSDOM } from 'jsdom';
import { describe, expect, test, vi } from 'vitest';
import type { Runtime } from 'webextension-polyfill';
import {
  asBrowser,
  makeBrowser,
  makeLogger,
} from '@/background/services/__tests__/helpers';
import type { Cradle } from '@/content/container';
import { ContentScript } from '@/content/services/contentScript';
import { ContentMessageManager } from '@/content/services/contentMessageManager';

vi.mock('@/shared/defines', () => ({
  LOG_LEVEL: 'debug',
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
  BUILD_TARGET: 'chrome',
}));

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
  const fakeBrowser = makeBrowser();
  fakeBrowser.runtime.connect.mockReturnValue(port as unknown as Runtime.Port);
  const { runtime } = fakeBrowser;
  const browser = asBrowser(fakeBrowser);
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
    logger: makeLogger(),
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
      // ContentScript's handler only uses the message
      const onMessage = cs.runtime.onMessage.addListener.mock
        .calls[0][0] as unknown as (msg: unknown) => Promise<unknown>;

      const res = await onMessage({ action: 'IS_TAB_IN_VIEW' });

      expect(res).toEqual({ success: true, payload: inView });
    },
  );
});
