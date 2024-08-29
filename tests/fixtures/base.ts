// cSpell:ignore serviceworker

import path from 'node:path';
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { DIST_DIR } from '../../esbuild/config';

export const test = base.extend<{
  pathToExtension: string;
  context: BrowserContext;
  extensionId: string;
}>({
  pathToExtension: ({ browserName }, use) => {
    let pathToExtension: string | undefined;
    if (browserName === 'chromium') {
      pathToExtension = path.join(DIST_DIR, 'chrome');
    } else if (browserName === 'firefox') {
      pathToExtension = path.join(DIST_DIR, 'firefox');
    }

    if (!pathToExtension) {
      throw new Error('Unknown browser: ' + browserName);
    }
    use(pathToExtension);
  },

  context: async ({ browserName, pathToExtension }, use) => {
    let context: BrowserContext | undefined;
    if (browserName === 'chromium') {
      context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
        ],
      });
    }

    if (!context) {
      throw new Error('Unknown browser: ' + browserName);
    }

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // chromium only atm
    let background = context.serviceWorkers()[0];
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
