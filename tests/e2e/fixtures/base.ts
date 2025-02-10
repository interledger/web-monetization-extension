import {
  test as base,
  type ExpectMatcherState,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import type { Spy, SpyFn } from 'tinyspy';
import {
  getBackground,
  getStorage,
  loadContext,
  BrowserIntl,
  type Background,
  getLastCalledWith,
} from './helpers';
import { getLastCallArg } from '../helpers/common';
import { openPopup, type Popup } from '../pages/popup';
import type { DeepPartial, Storage } from '@/shared/types';

type Fixtures = {
  context: BrowserContext;
  background: Background;
  popup: Popup;
  i18n: BrowserIntl;
  page: Page;
};

export const test = base.extend<Fixtures>({
  context: [
    async ({ browserName, channel }, use, testInfo) => {
      const context = await loadContext({ browserName, channel }, testInfo);
      await use(context);
      await context.close();
    },
    { scope: 'test', timeout: 5_000 },
  ],

  // This is the background service worker in Chrome, and background script
  // context in Firefox. We can run extension APIs, such as
  // `chrome.storage.local.get` in this context with `background.evaluate()`.
  background: [
    async ({ context, browserName }, use) => {
      const background = await getBackground(browserName, context);
      await use(background);
    },
    { scope: 'test', timeout: 5_000 },
  ],

  i18n: [
    async ({ browserName }, use) => {
      const i18n = new BrowserIntl(browserName);
      await use(i18n);
    },
    { scope: 'test' },
  ],

  popup: [
    async ({ background, context }, use) => {
      const popup = await openPopup(context, background);

      await use(popup);
      await popup.close();
    },
    { scope: 'test', timeout: 5_000 },
  ],

  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

const defaultMessage = (
  thisType: ExpectMatcherState,
  assertionName: string,
  _pass: boolean,
  expected: unknown,
  matcherResult?: { actual: unknown },
) => {
  return () => {
    const hint = thisType.utils.matcherHint(
      assertionName,
      undefined,
      undefined,
      { isNot: thisType.isNot },
    );
    const expectedPart = `Expected: ${thisType.isNot ? 'not ' : ''}${thisType.utils.printExpected(expected)}`;
    const receivedPart = matcherResult
      ? `Received: ${thisType.utils.printReceived(matcherResult.actual)}`
      : '';
    return `${hint}\n\n${expectedPart}\n${receivedPart}`;
  };
};

export const expect = test.expect.extend({
  async toHaveStorage(background: Background, expected: DeepPartial<Storage>) {
    const name = 'toHaveStorage';

    let pass: boolean;
    let result: { actual: unknown } | undefined;

    const storedData = await getStorage(
      background,
      Object.keys(expected) as Array<keyof typeof expected>,
    );
    try {
      test.expect(storedData).toMatchObject(expected);
      pass = true;
    } catch {
      result = { actual: storedData };
      pass = false;
    }

    return {
      name,
      pass,
      expected,
      actual: result?.actual,
      message: defaultMessage(this, name, pass, expected, result),
    };
  },

  async toHaveBeenCalledTimes(
    fn: SpyFn,
    expected: number,
    { timeout = 5000 }: { timeout?: number } = {},
  ) {
    const name = 'toHaveBeenCalledTimes';

    let pass: boolean;
    let result: { actual: number } | undefined;

    try {
      await test.expect.poll(() => fn.callCount, { timeout }).toBe(expected);
      pass = true;
    } catch {
      result = { actual: fn.callCount };
      pass = false;
    }

    return {
      name,
      pass,
      expected,
      actual: result?.actual,
      message: defaultMessage(this, name, pass, expected, result),
    };
  },

  async toHaveBeenLastCalledWithMatching(
    fn: SpyFn,
    expected: Record<string, unknown>,
    { timeout = 5000 }: { timeout?: number } = {},
  ) {
    // Playwright doesn't let us extend to created generic matchers, so we'll
    // typecast (as) in the way we need it.
    type SpyFnTyped = SpyFn<[Record<string, string>]>;
    const name = 'toHaveBeenLastCalledWithMatching';

    let pass: boolean;
    let result: { actual: unknown } | undefined;

    try {
      // we only support matching first argument of last call
      await test.expect
        .poll(() => getLastCallArg(fn as SpyFnTyped), { timeout })
        .toMatchObject(expected);
      pass = true;
    } catch {
      result = { actual: getLastCallArg(fn as SpyFnTyped) };
      pass = false;
    }

    return {
      name,
      pass,
      expected,
      actual: result?.actual,
      message: defaultMessage(this, name, pass, expected, result),
    };
  },

  toHaveLastAmountSentCloseTo(fn: SpyFn, expected: number) {
    const name = 'toHaveLastAmountSentCloseTo';

    // Playwright doesn't let us extend to created generic matchers, so we'll
    // typecast (as) in the way we need it.
    type SpyFnTyped = SpyFn<[window.MonetizationEvent]>;

    let pass: boolean;
    let result: { actual: unknown } | undefined;

    const getAmount = () => {
      const lastCallArg = getLastCallArg(fn as SpyFnTyped);
      return lastCallArg?.amountSent?.value;
    };

    try {
      expect(Number(getAmount())).toBeCloseTo(expected, 1);
      pass = true;
    } catch {
      result = { actual: getAmount() };
      pass = false;
    }

    return {
      name,
      pass,
      expected,
      actual: result?.actual,
      message: defaultMessage(this, name, pass, expected, result),
    };
  },

  toHaveAmountCloseTo(
    monetizationCallback: SpyFn<[window.MonetizationEvent]>,
    expected: number,
    numDigits = 1,
  ) {
    const name = 'toHaveAmount';
    let pass: boolean;
    let result: { actual: number } | undefined;

    const lastCallArg = getLastCalledWith(monetizationCallback);
    const value = Number(lastCallArg.amountSent.value);
    try {
      expect(value).toBeCloseTo(expected, numDigits);
      pass = true;
    } catch {
      pass = false;
      result = { actual: value };
    }

    return {
      name,
      pass,
      expected,
      actual: result?.actual,
      message: defaultMessage(this, name, pass, expected, result),
    };
  },
});
