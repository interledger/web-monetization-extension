import {
  acceptConsent,
  acceptGrant,
  click,
  getStorage,
  loginToTestWallet,
  openPopup,
  setStorage,
  switchToUrl,
  t,
} from './fixtures/helpers';

describe('connect', () => {
  let main: string;

  before(async () => {
    main = await browser.getWindowHandle();
    await acceptConsent(main);
    await loginToTestWallet();
  });

  it('connects with correct details provided', async () => {
    let popup = await openPopup(main);
    expect(await getStorage(['connected'])).toEqual({ connected: false });

    await setStorage({
      keyId: process.env.TEST_WALLET_KEY_ID,
      privateKey: process.env.TEST_WALLET_PRIVATE_KEY,
      publicKey: process.env.TEST_WALLET_PUBLIC_KEY,
    });
    await $('#connectWalletAddressUrl').setValue(
      process.env.TEST_WALLET_ADDRESS_URL,
    );
    await browser.keys('Tab');
    // Connect is enabled once the wallet details (and default budget) load.
    const connect = `button*=${await t('connectWallet_connect_action')}`;
    await $(connect).waitForEnabled();
    const amount = $('#connectAmount');
    await amount.setValue('10');
    await browser.keys('Tab');
    await expect(amount).toHaveValue('10.00');
    const recurring = await $('#connectRecurring');
    if (await recurring.isSelected()) {
      await browser.execute((el) => el.click(), recurring);
    }
    await expect(recurring).not.toBeSelected();
    await click(connect);

    await switchToUrl((url) => url.includes('interactId='));
    await acceptGrant();
    await browser.waitUntil(async () =>
      (await browser.getUrl()).endsWith('/pages/app/index.html#/post-connect'),
    );
    await expect($('[data-testid="post-connect-result"]')).toHaveText(
      await t('postConnect_connect_success_title'),
      { wait: 20_000 },
    );
    await browser.closeWindow();

    popup = await openPopup(main);
    await browser.waitUntil(
      async () => (await getStorage(['connected'])).connected,
      { timeout: 30_000, interval: 1000 },
    );
    // The popup moved to the connect route while connecting; start from home.
    await browser.url(`${process.env.EXTENSION_BASE_URL}/popup/index.html`);
    await expect(
      $(`aria/${await t('header_settings_action')}`),
    ).toBeDisplayed();
    expect(
      await getStorage(['connected', 'recurringGrant', 'oneTimeGrant']),
    ).toMatchObject({
      connected: true,
      recurringGrant: null,
      oneTimeGrant: {
        type: 'one-time',
        amount: {
          value: '1000', // asset scale 2
        },
      },
    });

    await browser.switchToWindow(main);
    await browser.url('https://webmonetization.org/play/');
    await browser.switchToWindow(popup);
    await expect($('h3')).toHaveText(await t('notMonetized_noLinks_text'));

    await click(`aria/${await t('header_settings_action')}`);
    await click(`aria/${await t('settings_tabs_wallet_text')}`);
    await click(`button=${await t('settings_wallet_disconnect_action')}`);
    await click(
      `button=${await t('settings_wallet_disconnectConfirm_action')}`,
    );
    await expect($('[data-testid="connect-wallet-form"]')).toBeDisplayed();
    expect(await getStorage(['connected'])).toEqual({ connected: false });
  });
});
