import { test as base, type BrowserContext, type Page } from '@playwright/test';
import {
  getBackground,
  getExtensionId,
  loadContext,
  type Background,
} from './helpers';
import { openPopup, type Popup } from '../pages/popup';

type BaseScopeWorker = {
  persistentContext: BrowserContext;
  background: Background;
  /**
   * IMPORTANT: This is created once per test file. Mutating/closing could
   * impact other tests in same file.
   */
  popup: Popup;
};

export const test = base.extend<{ page: Page }, BaseScopeWorker>({
  // Extensions only work with a persistent context.
  // Ideally we wanted this fixture to be named "context", but it's already defined in default base context under the scope "test".
  persistentContext: [
    async ({ browserName, channel }, use) => {
      const context = await loadContext({ browserName, channel });
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  // This is the background service worker in Chrome, and background script
  // context in Firefox. We can run extension APIs, such as
  // `chrome.storage.local.get` in this context with `background.evaluate()`.
  background: [
    async ({ persistentContext: context, browserName }, use) => {
      const background = await getBackground(browserName, context);
      await use(background);
    },
    { scope: 'worker' },
  ],

  popup: [
    async ({ background, persistentContext, browserName, channel }, use) => {
      const extensionId = getExtensionId(browserName, background);
      const popup = await openPopup(
        persistentContext,
        { browserName, channel },
        extensionId,
      );

      await use(popup);
      await popup.close();
    },
    { scope: 'worker' },
  ],

  page: async ({ persistentContext: context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;
