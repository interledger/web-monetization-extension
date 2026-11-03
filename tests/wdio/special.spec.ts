import {
  acceptConsent,
  connectWallet,
  loginToTestWallet,
  openPopup,
  playgroundUrl,
} from './fixtures/helpers';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

// Connecting is slow, so all checks share one connected session.
describe('special', () => {
  let main: string;
  let popup: string;
  let tab: string;
  let initScripts: { remove: () => Promise<void> }[] = [];
  const homePage = () => $('[data-testid="home-page"]');
  const notMonetized = () => $('[data-testid="not-monetized-message"]');

  const inTab = async <T>(fn: () => Promise<T>) => {
    await browser.switchToWindow(tab);
    const result = await fn();
    await browser.switchToWindow(popup);
    return result;
  };

  const setupPlayground = () =>
    inTab(async () => {
      const events: string[] = [];
      const script = await browser.addInitScript<string>((emit) => {
        window.addEventListener('monetization', (ev) => {
          emit((ev as Event & { walletAddress: string }).walletAddress);
        });
      });
      script.on('data', (data) => events.push(data));
      initScripts.push(script);
      await browser.url(playgroundUrl(walletAddressUrl));
      return events;
    });

  // The playground's CSP blocks these frames. Chrome still fires `load` for
  // them, Firefox fires `securitypolicyviolation` instead.
  const loadIframe = (src: string) =>
    inTab(async () => {
      await browser.execute((src) => {
        const existing = document.getElementById('cross-origin-iframe');
        const el = existing ?? document.createElement('iframe');
        el.id = 'cross-origin-iframe';
        el.setAttribute('src', src);
        if (!existing) document.body.prepend(el);
        const done = () => {
          el.dataset.loaded = src;
          document.removeEventListener('securitypolicyviolation', onBlocked);
        };
        const onBlocked = (ev: SecurityPolicyViolationEvent) => {
          if (ev.blockedURI.startsWith(src)) done();
        };
        el.addEventListener('load', done, { once: true });
        document.addEventListener('securitypolicyviolation', onBlocked);
      }, src);
      await $(`#cross-origin-iframe[data-loaded="${src}"]`).waitForExist();
    });

  // De-monetization can happen a bit after the iframe changes.
  const expectStaysMonetized = async () => {
    for (let i = 0; i < 10; i++) {
      await expect(notMonetized()).not.toBeDisplayed();
      await expect(homePage()).toBeDisplayed();
      await browser.pause(500);
    }
  };

  const setContinuousPayments = async (enabled: boolean) => {
    await browser.url(
      `${process.env.EXTENSION_BASE_URL}/popup/index.html#/settings/rate`,
    );
    const toggle = await $('[data-testid="continuous-payments-toggle"]');
    if ((await toggle.isSelected()) !== enabled) {
      await browser.execute((el) => el.click(), toggle);
    }
    await browser.waitUntil(
      async () => (await toggle.isSelected()) === enabled,
    );
    await browser.url(`${process.env.EXTENSION_BASE_URL}/popup/index.html`);
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
    for (const script of initScripts) {
      await script.remove();
    }
    initScripts = [];
    await browser.switchToWindow(tab);
    await browser.closeWindow();
  });

  it('iframe add/remove does not de-monetize main page', async () => {
    await expect(notMonetized()).toBeDisplayed();

    const events = await setupPlayground();
    await browser.waitUntil(() => events.length === 1, { timeout: 20_000 });
    expect(events).toEqual([walletAddressUrl]);
    await expect(homePage()).toBeDisplayed();

    await loadIframe('https://example.com');
    await inTab(() => expect($('#cross-origin-iframe')).toBeDisplayed());
    await expect(homePage()).toBeDisplayed();

    await inTab(() =>
      browser.execute(() => {
        document.getElementById('cross-origin-iframe')?.remove();
      }),
    );
    await inTab(() => expect($('#cross-origin-iframe')).not.toBeExisting());
    await expectStaysMonetized();
  });

  it('iframe navigate does not de-monetize main page', async () => {
    await expect(notMonetized()).toBeDisplayed();

    const events = await setupPlayground();
    await browser.waitUntil(() => events.length === 1, { timeout: 20_000 });
    expect(events).toEqual([walletAddressUrl]);
    await expect(homePage()).toBeDisplayed();

    await loadIframe('https://example.com');
    await loadIframe('https://example.net');
    await expectStaysMonetized();
  });

  it('keep site monetized on back-forward buttons', async () => {
    // Payments aren't needed to see the monetized status.
    await setContinuousPayments(false);

    // `persisted` is true when the page comes from the back-forward cache,
    // which keeps the page's own list of pageshow events.
    const script = await inTab(() =>
      browser.addInitScript(() => {
        const shows: boolean[] = [];
        Object.assign(window, { pageShows: shows });
        window.addEventListener('pageshow', (ev) => shows.push(ev.persisted));
      }),
    );
    initScripts.push(script);
    const expectPageShows = (url: string, shows: boolean[]) =>
      inTab(async () => {
        await expect(browser).toHaveUrl(url);
        await browser.waitUntil(async () => {
          const got = await browser.execute(
            () => (window as unknown as { pageShows: boolean[] }).pageShows,
          );
          return JSON.stringify(got) === JSON.stringify(shows);
        });
      });

    const urlA = playgroundUrl(walletAddressUrl);
    const urlB = 'https://example.com/';

    await inTab(() => browser.url(urlA));
    await expectPageShows(urlA, [false]);
    await expect(homePage()).toBeDisplayed();
    await expect(notMonetized()).not.toBeDisplayed();

    await inTab(() => browser.url(urlB));
    await expectPageShows(urlB, [false]);
    await expect(homePage()).not.toBeDisplayed();
    await expect(notMonetized()).toBeDisplayed();

    await inTab(() => browser.execute(() => history.back()));
    await expectPageShows(urlA, [false, true]);
    await expect(homePage()).toBeDisplayed();
    await expect(notMonetized()).not.toBeDisplayed();

    await inTab(() => browser.execute(() => history.forward()));
    await expectPageShows(urlB, [false, true]);
    await expect(homePage()).not.toBeDisplayed();
    await expect(notMonetized()).toBeDisplayed();

    await setContinuousPayments(true);
  });
});
