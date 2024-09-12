import { test as base, type BrowserContext, type Page } from '@playwright/test';
import {
  getBackground,
  getExtensionId,
  loadContext,
  type Background,
} from './helpers';

type BaseScopeWorker = {
  persistentContext: BrowserContext;
  background: Background;
  extensionId: string;
};

export const test = base.extend<{ page: Page }, BaseScopeWorker>({
  // Extensions only work with a persistent context.
  // Ideally we wanted this fixture to be named "context", but it's already defined in default base context under the scope "test".
  persistentContext: [
    async ({ browserName }, use) => {
      const context = await loadContext(browserName);
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

  // Needed to get access to popup page
  extensionId: [
    async ({ background, browserName }, use) => {
      await use(getExtensionId(browserName, background));
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
