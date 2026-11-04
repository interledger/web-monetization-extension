import { describe, expect, test, vi } from 'vitest';
import type { Runtime } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';
import { Background } from '@/background/services/background';

// Chromium: Firefox and Safari inject into open tabs themselves
vi.mock('@/shared/defines', () => ({
  LOG_LEVEL: 'debug',
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
  BUILD_TARGET: 'chrome',
}));

type OnInstalledReason = Runtime.OnInstalledReason;

function setup() {
  let onInstalled: (details: { reason: OnInstalledReason }) => Promise<void> =
    async () => {};
  const browser = {
    runtime: {
      onInstalled: {
        addListener: vi.fn((listener: typeof onInstalled) => {
          onInstalled = listener;
        }),
      },
      getURL: vi.fn((path: string) => `chrome-extension://ext-id/${path}`),
    },
    tabs: {
      query: vi.fn().mockResolvedValue([
        { id: 1, url: 'https://example.com/' },
        { id: 2, url: 'chrome://extensions/' },
      ]),
      create: vi.fn(),
    },
    scripting: { executeScript: vi.fn().mockResolvedValue([]) },
  };
  const storage = {
    get: vi.fn().mockResolvedValue({ version: 1 }),
    populate: vi.fn(),
    migrate: vi.fn().mockResolvedValue(null),
    setState: vi.fn(),
  };
  const background = new Background({
    browser,
    storage,
    walletService: { generateKeys: vi.fn() },
    logger: { info: vi.fn(), log: vi.fn(), debug: vi.fn(), error: vi.fn() },
  } as unknown as Cradle);
  background.bindOnInstalled();

  return {
    browser,
    fireOnInstalled: (reason: OnInstalledReason) => onInstalled({ reason }),
  };
}

describe('onInstalled', () => {
  test.each(['install', 'update'] as const)(
    'injects the polyfill and content script into open tabs on %s',
    async (reason) => {
      const { browser, fireOnInstalled } = setup();

      await fireOnInstalled(reason);

      const injected = browser.scripting.executeScript.mock.calls.map(
        ([details]) => [details.target.tabId, details.files[0]],
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
