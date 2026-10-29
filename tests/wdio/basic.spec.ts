import { acceptConsent, getStorage, openPopup, t } from './fixtures/helpers';

describe('basic', () => {
  let main: string;

  before(async () => {
    main = await browser.getWindowHandle();
    await acceptConsent(main);
  });

  afterEach(async () => {
    for (const handle of await browser.getWindowHandles()) {
      if (handle !== main) {
        await browser.switchToWindow(handle);
        await browser.closeWindow();
      }
    }
    await browser.switchToWindow(main);
  });

  it('should load popup', async () => {
    await openPopup(main);
    await expect(browser).toHaveTitle('Web Monetization Extension');
    await expect($('#popup-container')).toBeExisting();
    await expect($('header')).toHaveText(await t('header_brand_text'));
    await expect($('header img')).toHaveAttribute(
      'src',
      expect.stringMatching(/logo\.svg$/),
    );
  });

  it('shows connect form if not connected', async () => {
    await browser.url('https://example.com');
    await openPopup(main);

    await expect(browser).toHaveTitle('Web Monetization Extension');
    await expect($('#popup-container')).toBeExisting();
    await expect($('header')).toHaveText(await t('header_brand_text'));

    await expect($('form')).toBeDisplayed();
    const submit = $('form button[type="submit"]');
    await expect(submit).toBeDisplayed();
    await expect(submit).toHaveText(await t('connectWallet_connect_action'));
  });

  describe('should fail to connect if:', () => {
    const fillWalletAddress = async (walletAddressUrl: string) => {
      await openPopup(main);
      await $('#connectWalletAddressUrl').setValue(walletAddressUrl);
      await browser.keys('Tab');
      return $('form button[type="submit"]');
    };

    it('invalid URL provided', async () => {
      const connect = await fillWalletAddress('abc');

      await expect(connect).toBeDisabled();
      await expect($('p.text-error')).toHaveText(
        await t('connectWallet_url_invalidUrl_error'),
      );
      expect(await getStorage(['connected'])).toEqual({ connected: false });
    });

    it('invalid wallet address provided', async () => {
      const connect = await fillWalletAddress('https://example.com');

      await expect(connect).toBeDisabled();
      await expect($('p.text-error')).toHaveText(
        expect.stringContaining('not a valid wallet address'),
      );
      expect(await getStorage(['connected'])).toEqual({ connected: false });
    });
  });
});
