// cSpell:ignore serviceworker

import path from 'node:path';
import {
  test as base,
  chromium,
  firefox,
  type BrowserContext,
  type Worker,
} from '@playwright/test';
import { DIST_DIR } from '../../esbuild/config';
import { loadFirefoxAddon } from './utils.firefox';

// just a random UUID, nothing specific
const FIREFOX_ADDON_UUID = '672e3c1a-b6cd-407d-a087-8a42e7bf3451';

export const test = base.extend<{
  pathToExtension: string;
  context: BrowserContext;
  background: Worker;
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
    } else if (browserName === 'firefox') {
      const RDP_PORT = 12345;
      context = await firefox.launchPersistentContext('', {
        headless: false,
        args: ['-start-debugger-server', String(RDP_PORT)],
        firefoxUserPrefs: {
          'devtools.debugger.remote-enabled': true,
          'devtools.debugger.prompt-connection': false,
          'extensions.webextensions.uuids': JSON.stringify({
            // See `browser_specific_settings.gecko.id` in manifest.json
            'tech@interledger.org': FIREFOX_ADDON_UUID,
          }),
        },
      });
      await loadFirefoxAddon(RDP_PORT, 'localhost', pathToExtension);
    }

    if (!context) {
      throw new Error('Unknown browser: ' + browserName);
    }

    await use(context);
    await context.close();
  },

  background: async ({ context, browserName }, use) => {
    let background;
    if (browserName === 'chromium') {
      background = context.serviceWorkers()[0];
      if (!background) {
        background = await context.waitForEvent('serviceworker');
      }
    } else if (browserName === 'firefox') {
      // TODO
      // background = context.backgroundPages()[0];
      // if (!background) {
      //
      // }
    } else {
      throw new Error('Unsupported browser: ' + browserName);
    }
    use(background);
  },

  extensionId: async ({ background, browserName }, use) => {
    if (browserName === 'firefox') {
      return FIREFOX_ADDON_UUID;
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
