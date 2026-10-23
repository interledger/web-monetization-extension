// Load the extension in Chrome or Firefox with WebdriverIO and open the popup.
// Usage: node webdriverio.mjs <chrome|firefox> [path/to/dist]
// biome-ignore-all lint/suspicious/noConsole: prints results
import path from 'node:path';
// biome-ignore lint/correctness/noUndeclaredDependencies: installed separately
import { remote } from 'webdriverio';

const [browser, dist = 'dist'] = process.argv.slice(2);
const FIREFOX_UUID = '7f1c5c4e-3a6b-4f5e-9c1d-2b8e0d4a9f10';

const capabilities = {
  chrome: {
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: [
        '--headless=new',
        '--enable-unsafe-extension-debugging',
        '--remote-debugging-pipe',
      ],
    },
  },
  firefox: {
    browserName: 'firefox',
    // Without this, navigating to moz-extension:// isn't allowed.
    'wdio:geckodriverOptions': { allowSystemAccess: true },
    'moz:firefoxOptions': {
      args: ['-headless'],
      prefs: {
        'extensions.webextensions.uuids': JSON.stringify({
          'tech@interledger.com': FIREFOX_UUID,
        }),
      },
    },
  },
}[browser];

const b = await remote({
  logLevel: 'error',
  capabilities: { ...capabilities, webSocketUrl: true },
});
try {
  const { extension } = await b.webExtensionInstall({
    extensionData: { type: 'path', path: path.resolve(dist, browser) },
  });
  console.log('installed:', extension);

  const popupUrl =
    browser === 'chrome'
      ? `chrome-extension://${extension}/popup/index.html`
      : `moz-extension://${FIREFOX_UUID}/popup/index.html`;

  const context = await b.getWindowHandle();
  await b.browsingContextNavigate({ context, url: popupUrl, wait: 'complete' });

  await b.pause(2500);
  console.log('popup:', (await b.$('body').getText()).replace(/\s+/g, ' '));
  await b.saveScreenshot(`${browser}-popup.png`);
} finally {
  await b.deleteSession();
}
