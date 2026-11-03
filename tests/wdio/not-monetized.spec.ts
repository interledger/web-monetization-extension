import { pathToFileURL } from 'node:url';
import {
  acceptConsent,
  connectWallet,
  loginToTestWallet,
  openPopup,
  t,
} from './fixtures/helpers';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

// Connecting is slow, so all checks share one connected session.
describe('not-monetized', () => {
  let main: string;
  let popup: string;
  let tab: string;
  const warning = () => $('[data-testid="not-monetized-message"]');

  const visit = async (url: string) => {
    await browser.switchToWindow(tab);
    await browser.url(url);
    await browser.switchToWindow(popup);
  };

  const expectWarning = async (key: string) => {
    await expect(warning()).toBeDisplayed();
    await expect(warning()).toHaveText(await t(key));
  };

  before(async () => {
    main = await browser.getWindowHandle();
    await acceptConsent(main);
    await loginToTestWallet();
    await openPopup(main);
    popup = await connectWallet(main);
  });

  beforeEach(async () => {
    await browser.switchToWindow(main);
    tab = (await browser.createWindow('tab')).handle;
    // Makes the new tab the active one before the popup reloads.
    await browser.switchToWindow(tab);
    await browser.switchToWindow(popup);
    await browser.refresh();
  });

  afterEach(async () => {
    await browser.switchToWindow(tab);
    await browser.closeWindow();
  });

  it('shows not monetized on empty tabs', async () => {
    await expectWarning('notMonetized_newTab_text');
  });

  it('shows not monetized on internal pages', async () => {
    const isFirefox = browser.capabilities.browserName === 'firefox';
    await visit(isFirefox ? 'about:preferences' : 'chrome://settings');
    await expectWarning('notMonetized_internalPage_text');
  });

  describe('shows not monetized on non-https pages', () => {
    it('http:// URLs', async () => {
      await visit('http://httpforever.com/');
      await expectWarning('notMonetized_unsupportedScheme_text');
    });

    it('navigating from https:// to http://', async () => {
      await visit('https://example.com');
      await expectWarning('notMonetized_noLinks_text');

      await visit('http://httpforever.com/');
      await expectWarning('notMonetized_unsupportedScheme_text');
    });

    it('file:// URLs', async () => {
      await visit(pathToFileURL('.').href);
      await expectWarning('notMonetized_unsupportedScheme_text');
    });

    it('extension pages', async () => {
      await visit(`${process.env.EXTENSION_BASE_URL}/popup/index.html`);
      await expectWarning('notMonetized_unsupportedScheme_text');
    });
  });

  describe('shows not monetized on non-monetized pages', () => {
    it('no link tags', async () => {
      await visit('https://example.com');
      await expectWarning('notMonetized_noLinks_text');
    });

    it('no enabled link tags', async () => {
      await visit('https://example.com');
      await browser.switchToWindow(tab);
      await browser.execute((walletAddressUrl) => {
        const link = document.createElement('link');
        link.rel = 'monetization';
        link.disabled = true;
        link.href = walletAddressUrl;
        document.head.appendChild(link);
      }, walletAddressUrl);
      await browser.switchToWindow(popup);
      await expectWarning('notMonetized_noLinks_text');
    });

    it('navigating from monetized to non-monetized', async () => {
      const playground = new URL('https://webmonetization.org/play/');
      playground.searchParams.append('wa', walletAddressUrl);
      await visit(playground.href);
      // Monetization starts once the wallet address is fetched.
      await expect(warning()).not.toBeDisplayed({ wait: 20_000 });

      await visit('https://example.com');
      await expectWarning('notMonetized_noLinks_text');
    });
  });
});
