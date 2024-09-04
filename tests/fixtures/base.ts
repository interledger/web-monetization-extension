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
  persistentContext: [
    async ({ browserName }, use) => {
      const context = await loadContext(browserName);
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  background: [
    async ({ persistentContext: context, browserName }, use) => {
      const background = await getBackground(browserName, context);
      await use(background);
    },
    { scope: 'worker' },
  ],

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
