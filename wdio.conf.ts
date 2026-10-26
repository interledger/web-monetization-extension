import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { DIST_DIR } from './scripts/esbuild/config';

if (!process.env.CI) {
  loadEnvFile(path.join(import.meta.dirname, 'tests', 'e2e', '.env'));
}

const extensionPath = (target: string) => path.join(DIST_DIR, target);

// Pinned so the extension's base URL is known before it's installed.
// See `browser_specific_settings.gecko.id` in manifest.json
export const FIREFOX_ADDON_UUID = '7f1c5c4e-3a6b-4f5e-9c1d-2b8e0d4a9f10';

const browsers = {
  chrome: {
    browserName: 'chrome',
    // Chrome for Testing; branded Chrome ignores --load-extension.
    browserVersion: 'stable',
    'goog:chromeOptions': {
      args: [
        '--headless=new',
        `--load-extension=${extensionPath('chrome')}`,
        // GitHub's Ubuntu runners block Chrome's sandbox.
        ...(process.env.CI ? ['--no-sandbox'] : []),
      ],
    },
  },
  firefox: {
    browserName: 'firefox',
    'moz:firefoxOptions': {
      args: ['-headless'],
      prefs: {
        'extensions.webextensions.uuids': JSON.stringify({
          'tech@interledger.com': FIREFOX_ADDON_UUID,
        }),
      },
    },
  },
};

// Lets WebDriver run scripts in extension pages.
process.env.MOZ_REMOTE_ALLOW_SYSTEM_ACCESS = '1';

const names = (process.env.WDIO_BROWSERS || 'chrome,firefox').split(',');

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./tests/wdio/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: names.map((name) => ({
    ...browsers[name as keyof typeof browsers],
    webSocketUrl: true,
  })),
  logLevel: 'error',
  // Tests run headless, and the xvfb-run wrapper breaks the worker's IPC on CI.
  autoXvfb: false,
  waitforTimeout: 10_000,
  framework: 'mocha',
  mochaOpts: { timeout: 120_000 },
  reporters: ['spec'],

  async before(capabilities) {
    const { browserName } = capabilities as WebdriverIO.Capabilities;
    if (browserName === 'firefox') {
      await browser.webExtensionInstall({
        extensionData: { type: 'path', path: extensionPath('firefox') },
      });
      process.env.EXTENSION_BASE_URL = `moz-extension://${FIREFOX_ADDON_UUID}`;
      process.env.EXTENSION_TARGET = 'firefox';
    } else {
      // An unpacked extension's ID comes from its path: the first 32 hex
      // characters of the SHA-256 hash, mapped to a-p.
      const id = createHash('sha256')
        .update(extensionPath('chrome'))
        .digest('hex')
        .slice(0, 32)
        .replace(/./g, (c) => String.fromCharCode(97 + Number.parseInt(c, 16)));
      process.env.EXTENSION_BASE_URL = `chrome-extension://${id}`;
      process.env.EXTENSION_TARGET = 'chrome';
    }
  },
};
