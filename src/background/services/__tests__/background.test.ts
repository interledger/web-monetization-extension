import { describe, expect, test, vi } from 'vitest';
import type { Runtime } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';
import { Background } from '@/background/services/background';
import { makeBrowser, makeLogger, makeStorage } from './helpers';

vi.mock('@/shared/defines', () => ({
  LOG_LEVEL: 'debug',
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
  // Chromium: Firefox and Safari inject into open tabs themselves
  BUILD_TARGET: 'chrome',
}));

type OnInstalledReason = Runtime.OnInstalledReason;

function setup() {
  const browser = makeBrowser();
  browser.tabs.query.mockResolvedValue([
    { id: 1, url: 'https://example.com/' },
    { id: 2, url: 'chrome://extensions/' },
  ]);
  const background = new Background({
    browser,
    storage: makeStorage(),
    walletService: { generateKeys: vi.fn() },
    logger: makeLogger(),
  } as unknown as Cradle);
  background.bindOnInstalled();
  const [onInstalled] = browser.runtime.onInstalled.addListener.mock.calls[0];

  return {
    browser,
    fireOnInstalled: (reason: OnInstalledReason) =>
      onInstalled({ reason, temporary: false }),
  };
}

describe('onInstalled', () => {
  test.each(['install', 'update'] as const)(
    'injects the polyfill and content script into open tabs on %s',
    async (reason) => {
      const { browser, fireOnInstalled } = setup();

      await fireOnInstalled(reason);

      const injected = browser.scripting.executeScript.mock.calls.map(
        ([details]) => [details.target.tabId, details.files?.[0]],
      );
      expect(injected).toEqual([
        [1, 'polyfill/polyfill.js'],
        [1, 'content/content.js'],
      ]);
    },
  );

  test.each([
    'browser_update',
    'chrome_update',
    'shared_module_update',
  ] as const)('does not inject into open tabs on %s', async (reason) => {
    const { browser, fireOnInstalled } = setup();

    // the content scripts already running in tabs still work in these cases
    await fireOnInstalled(reason as OnInstalledReason);

    expect(browser.tabs.query).not.toHaveBeenCalled();
    expect(browser.scripting.executeScript).not.toHaveBeenCalled();
  });
});
