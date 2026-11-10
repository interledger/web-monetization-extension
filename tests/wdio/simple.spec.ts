import {
  acceptConsent,
  closeWindows,
  connectWallet,
  DEFAULT_BUDGET,
  disconnectWallet,
  getStorage,
  goToHome,
  inWindow,
  loginToTestWallet,
  type MonetizationEventData,
  openPopup,
  setContinuousPayments,
  setupPlayground,
  t,
} from './fixtures/helpers';
import type { Storage } from '../../src/shared/types';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

// Each test connects with a fresh budget, like the Playwright tests.
describe('simple', () => {
  let main: string;
  let connectPopup: string;
  let popup: string;
  let tab: string;
  let initScripts: { remove: () => Promise<void> }[] = [];

  const inTab = <T>(fn: () => Promise<T>) => inWindow(tab, popup, fn);

  const openPlayground = () =>
    inTab(async () => {
      const { events, script } = await setupPlayground(walletAddressUrl);
      initScripts.push(script);
      await expect($('#link-events ul.events li:last-child')).toHaveText(
        'Load Event',
        { containing: true },
      );
      return events;
    });

  const waitForEvents = async (
    events: MonetizationEventData[],
    count: number,
  ) => {
    await browser.waitUntil(() => events.length >= count, { timeout: 20_000 });
    expect(events).toHaveLength(count);
  };

  // A payment can go out a bit after the page loads.
  const expectEventCountStays = async (
    events: MonetizationEventData[],
    count: number,
  ) => {
    for (let i = 0; i < 10; i++) {
      expect(events).toHaveLength(count);
      await browser.pause(500);
    }
  };

  const expectLastPayment = (events: MonetizationEventData[], value: RegExp) =>
    expect(events.at(-1)).toMatchObject({
      walletAddress: walletAddressUrl,
      amountSent: {
        currency: expect.stringMatching(/^[A-Z]{3}$/),
        value: expect.stringMatching(value),
      },
      incomingPayment: expect.stringContaining(
        new URL(walletAddressUrl).origin,
      ),
    });

  const expectStorage = (data: Partial<Storage>) => {
    const keys = Object.keys(data) as (keyof Storage)[];
    return browser.waitUntil(async () => {
      const stored = await getStorage(keys);
      return keys.every((key) => stored[key] === data[key]);
    });
  };

  const sendNow = async () =>
    $(`button[aria-label="${await t('pay_action')}"]`);

  const togglePayments = async (key: string) => {
    const toggle = await $(`input[aria-label="${await t(key)}"]`);
    await toggle.waitForExist();
    await browser.execute((el) => el.click(), toggle);
  };

  const sendOneTimePayment = async (amount: number) => {
    await $('#payAmount').setValue(amount.toString());
    const button = await sendNow();
    await button.waitForClickable();
    await button.click();
    return button;
  };

  before(async () => {
    main = await browser.getWindowHandle();
    await acceptConsent(main);
    await loginToTestWallet();
  });

  beforeEach(async () => {
    connectPopup = await openPopup(main);
    popup = await connectWallet(main);
    await browser.switchToWindow(main);
    tab = (await browser.createWindow('tab')).handle;
    // Makes the new tab the active one before the popup reloads.
    await browser.switchToWindow(tab);
    await browser.switchToWindow(popup);
    await browser.refresh();
  });

  afterEach(async () => {
    for (const script of initScripts) {
      await script.remove();
    }
    initScripts = [];
    try {
      await browser.switchToWindow(popup);
      await disconnectWallet();
    } finally {
      await closeWindows([tab, connectPopup, popup], main);
    }
  });

  it('should monetize site with single wallet address', async () => {
    const events = await openPlayground();
    await waitForEvents(events, 1);
    expectLastPayment(events, /^0\.\d+$/);

    await goToHome();
    await expect(await sendNow()).toBeDisplayed();
    await expect($$('input[type="text"]')).toBeElementsArrayOfSize(1);
  });

  it('does not monetize when continuous payments are disabled', async () => {
    await expectStorage({ continuousPaymentsEnabled: true });
    await setContinuousPayments(false);
    await expect(
      $(`p*=${await t('settings_rate_continuousPayments_disabled_text')}`),
    ).toBeDisplayed();
    await expectStorage({ continuousPaymentsEnabled: false });

    const events = await openPlayground();
    await expectStorage({ continuousPaymentsEnabled: false });
    await expectEventCountStays(events, 0);

    // But can send a one-time payment.
    await goToHome();
    await expect(await sendNow()).toBeDisplayed();
    await expect($$('input[type="text"]')).toBeElementsArrayOfSize(1);
    await sendOneTimePayment(1.5);
    await waitForEvents(events, 1);
    expectLastPayment(events, /^1\.\d+$/);

    // And re-enabling sends continuous payments.
    await setContinuousPayments(true);
    await goToHome();
    await expectStorage({ continuousPaymentsEnabled: true });
    await waitForEvents(events, 2);
    expectLastPayment(events, /^0\.\d+$/);
  });

  it('does not monetize when global payments toggle in unchecked', async () => {
    await expectStorage({ continuousPaymentsEnabled: true, enabled: true });
    await togglePayments('header_togglePayments_disable_action');
    await expect($('[data-testid="not-monetized-message"]')).toHaveText(
      await t('app_disabled_text'),
    );
    await expectStorage({ continuousPaymentsEnabled: true, enabled: false });

    const events = await openPlayground();
    await inTab(() =>
      expect($$('#link-events ul.events li')).toBeElementsArrayOfSize(1),
    );

    await expect(await sendNow()).not.toBeDisplayed();
    await expectEventCountStays(events, 0);

    // Continuous payments toggle doesn't monetize either.
    await setContinuousPayments(false);
    await expectStorage({ continuousPaymentsEnabled: false, enabled: false });
    await expectEventCountStays(events, 0);
    await expect(
      $(`p*=${await t('settings_rate_continuousPayments_disabled_text')}`),
    ).toBeDisplayed();

    await setContinuousPayments(true);
    await expectStorage({ continuousPaymentsEnabled: true, enabled: false });
    await expectEventCountStays(events, 0);

    // Re-enabling the extension monetizes again.
    await goToHome();
    await togglePayments('header_togglePayments_enable_action');
    await expect(await sendNow()).toBeDisplayed();
    await expectStorage({ continuousPaymentsEnabled: true, enabled: true });
    await waitForEvents(events, 1);
  });

  describe('one-time payment', () => {
    const form = () => $('[data-testid="pay-form"]');
    const alert = () => form().$('[role="alert"]');

    beforeEach(async () => {
      await setContinuousPayments(false);
      await expectStorage({ continuousPaymentsEnabled: false });
      await goToHome();
    });

    it('should send when within budget', async () => {
      const events = await openPlayground();
      expect(events).toHaveLength(0);
      await expect(form()).toBeDisplayed();

      const amount = DEFAULT_BUDGET / 2;
      const button = await sendOneTimePayment(amount);
      await expect(button).toHaveAttribute('data-progress', 'true');
      await expect(alert()).not.toBeDisplayed();
      await waitForEvents(events, 1);
      expect(Number(events.at(-1)?.amountSent.value)).toBeCloseTo(amount, 1);

      await expect(button).toHaveAttribute('data-progress', 'false', {
        wait: 10_000,
      });
      await expect(alert()).toBeDisplayed();
      expect([
        await t('pay_success_text'),
        await t('pay_outgoingPaymentPollingIncomplete_warn'),
      ]).toContain(await alert().getText());
    });

    describe('should not send when outside budget', () => {
      it('more than total budget', async () => {
        const events = await openPlayground();
        expect(events).toHaveLength(0);
        await expect(form()).toBeDisplayed();

        const button = await sendOneTimePayment(DEFAULT_BUDGET * 1.2);
        await expect(alert()).toHaveText(await t('pay_notEnoughFunds_error'));
        await expect(button).toHaveAttribute('data-progress', 'false');
        await expect(button).toBeEnabled();
        expect(events).toHaveLength(0);
      });

      it('more than remaining balance', async () => {
        const events = await openPlayground();
        expect(events).toHaveLength(0);
        await expect(form()).toBeDisplayed();

        const first = await sendOneTimePayment(0.75 * DEFAULT_BUDGET);
        await waitForEvents(events, 1);
        await browser.waitUntil(
          async () => (await first.getAttribute('data-progress')) === 'false',
        );
        await browser.refresh();

        const button = await sendOneTimePayment(0.5 * DEFAULT_BUDGET);
        await expect(alert()).toHaveText(await t('pay_notEnoughFunds_error'));
        await expect(button).toHaveAttribute('data-progress', 'false');
        await expect(button).toBeEnabled();
        expect(events).toHaveLength(1);
      });
    });
  });
});
