import {
  acceptConsent,
  click,
  connectWallet,
  getStorage,
  loginToTestWallet,
  openPopup,
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
    await openPopup(main);
    expect(await getStorage(['connected'])).toEqual({ connected: false });

    const popup = await connectWallet(main);
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
