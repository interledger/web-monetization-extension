import { withResolvers } from '@/shared/helpers';
import { test, expect } from './fixtures/connected';

test('does not monetize when continuous payments are disabled', async ({
  page,
  popup,
  background,
}) => {
  const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
  const playgroundUrl = 'https://webmonetization.org/play/';

  const promises = new (class {
    #current: ReturnType<typeof withResolvers>;

    set() {
      this.#current = withResolvers<Event>();
    }

    get resolve() {
      return this.#current.resolve;
    }

    get promise() {
      return this.#current.promise;
    }
  })();

  await test.step('disable continuous payments', async () => {
    await expect(background).toHaveStorage({ continuousPaymentsEnabled: true });

    const settingsLink = popup.locator(`[href="/settings"]`).first();
    await settingsLink.click();

    await popup.bringToFront();
    await popup.getByRole('tab', { name: 'Rate' }).click();
    await popup
      .getByTestId('continuous-payments-toggle')
      .uncheck({ force: true });

    await expect(
      popup.getByRole('tabpanel', { name: 'Rate' }).locator('p'),
    ).toContainText('Ongoing payments are now disabled');

    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: false,
    });
  });

  promises.set();
  const monetizationCallback = (ev: Event) => promises.resolve(ev);
  await page.goto(playgroundUrl);
  await page.exposeFunction('monetizationCallback', monetizationCallback);

  await test.step('check continuous payments do not go through', async () => {
    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: false,
    });

    await page.evaluate(() => {
      addEventListener('monetization', monetizationCallback, { once: true });
    });

    await page
      .getByLabel('Wallet address/Payment pointer')
      .fill(walletAddressUrl);
    await page.getByRole('button', { name: 'Add monetization link' }).click();

    await expect(page.locator('link[rel=monetization]')).toHaveAttribute(
      'href',
      walletAddressUrl,
    );

    await page.waitForSelector('#link-events .log-header');
    await page.waitForSelector('#link-events ul.events li');
    await expect(
      page.locator('#link-events ul.events li').last(),
    ).toContainText('Load Event');

    const monetizationPromise = Promise.race([
      promises.promise,
      new Promise<void>((_, reject) => {
        AbortSignal.timeout(5000).addEventListener('abort', () =>
          reject('timeout'),
        );
      }),
    ]);

    expect(monetizationPromise).rejects.toBe('timeout');
  });

  await test.step('but can send one-time payment', async () => {
    await popup.reload();
    await expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();
    expect(await popup.getByRole('textbox').all()).toHaveLength(1);

    await popup.getByRole('textbox').fill('1');
    await popup.getByRole('button', { name: 'Send now' }).click();

    promises.set();
    await page.evaluate(() => {
      addEventListener('monetization', monetizationCallback, { once: true });
    });

    const monetizationPromise = Promise.race([
      promises.promise,
      new Promise<void>((_, reject) => {
        AbortSignal.timeout(5000).addEventListener('abort', () =>
          reject('timeout'),
        );
      }),
    ]);

    await expect(monetizationPromise).resolves.toMatchObject({
      paymentPointer: walletAddressUrl,
      amountSent: {
        currency: expect.stringMatching(/^[A-Z]{3}$/),
        value: expect.stringMatching(/^\d+\.\d+$/),
      },
      incomingPayment: expect.stringContaining(
        new URL(walletAddressUrl).origin,
      ),
    });
  });

  await test.step('and re-enabling lets send continuous payments', async () => {
    const settingsLink = popup.locator(`[href="/settings"]`).first();
    await settingsLink.click();

    await popup.bringToFront();
    await popup.getByRole('tab', { name: 'Rate' }).click();
    await popup
      .getByTestId('continuous-payments-toggle')
      .check({ force: true });

    await expect(background).toHaveStorage({
      continuousPaymentsEnabled: true,
    });

    promises.set();
    await page.evaluate(() => {
      addEventListener('monetization', monetizationCallback, { once: true });
    });

    const monetizationPromise = Promise.race([
      promises.promise,
      new Promise<void>((_, reject) =>
        AbortSignal.timeout(5000).addEventListener('abort', reject),
      ),
    ]);
    await expect(monetizationPromise).resolves.toMatchObject({
      paymentPointer: walletAddressUrl,
      amountSent: {
        currency: expect.stringMatching(/^[A-Z]{3}$/),
        value: expect.stringMatching(/^\d+\.\d+$/),
      },
      incomingPayment: expect.stringContaining(
        new URL(walletAddressUrl).origin,
      ),
    });
  });
});
