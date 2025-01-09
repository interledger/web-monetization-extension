import {
  test as base,
  type ExpectMatcherState,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import type { SpyFn } from 'tinyspy';
import {
  getBackground,
  getStorage,
  loadContext,
  BrowserIntl,
  type Background,
} from './helpers';
import { openPopup, type Popup } from '../pages/popup';
import { sleep } from '@/shared/helpers';
import type { DeepPartial, Storage } from '@/shared/types';

type BaseScopeWorker = {
  persistentContext: BrowserContext;
  background: Background;
  i18n: BrowserIntl;
  /**
   * IMPORTANT: This is created once per test file. Mutating/closing could
   * impact other tests in same file.
   */
  popup: Popup;
};

export const test = base.extend<{ page: Page }, BaseScopeWorker>({
  // Extensions only work with a persistent context.
  // Ideally we wanted this fixture to be named "context", but it's already defined in default base context under the scope "test".
  persistentContext: [
    async ({ browserName, channel }, use, workerInfo) => {
      const context = await loadContext({ browserName, channel }, workerInfo);
      await use(context);
      await context.close();
    },
    { scope: 'worker' },
  ],

  // This is the background service worker in Chrome, and background script
  // context in Firefox. We can run extension APIs, such as
  // `chrome.storage.local.get` in this context with `background.evaluate()`.
  background: [
    async ({ persistentContext: context, browserName }, use) => {
      const background = await getBackground(browserName, context);
      await use(background);
    },
    { scope: 'worker' },
  ],

  i18n: [
    async ({ browserName }, use) => {
      const i18n = new BrowserIntl(browserName);
      await use(i18n);
    },
    { scope: 'worker' },
  ],

  popup: [
    async ({ background, persistentContext }, use) => {
      const popup = await openPopup(persistentContext, background);

      await use(popup);
      await popup.close();
    },
    { scope: 'worker' },
  ],

  page: async ({ persistentContext: context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

const defaultMessage = (
  thisType: ExpectMatcherState,
  assertionName: string,
  pass: boolean,
  expected: unknown,
  matcherResult?: { actual: unknown },
) => {
  return () =>
    `${thisType.utils.matcherHint(assertionName, undefined, undefined, {
      isNot: thisType.isNot,
    })}\n\nExpected:${pass ? '' : ' not '}${thisType.utils.printExpected(expected)}\n${
      matcherResult
        ? `Received: ${thisType.utils.printReceived(matcherResult.actual)}`
        : ''
    }`;
};

export const expect = test.expect.extend({
  async toHaveStorage(background: Background, expected: DeepPartial<Storage>) {
    const assertionName = 'toHaveStorage';

    let pass: boolean;
    let matcherResult: any;

    const storedData = await getStorage(
      background,
      Object.keys(expected) as Array<keyof typeof expected>,
    );
    try {
      test.expect(storedData).toMatchObject(expected);
      pass = true;
    } catch {
      matcherResult = { actual: storedData };
      pass = false;
    }

    return {
      name: assertionName,
      pass,
      expected,
      actual: matcherResult?.actual,
      message: defaultMessage(
        this,
        assertionName,
        pass,
        expected,
        matcherResult,
      ),
    };
  },

  async toHaveBeenCalledTimes(
    fn: SpyFn,
    expected: number,
    { timeout = 5000, wait = 1000 }: { timeout?: number; wait?: number } = {},
  ) {
    const assertionName = 'toHaveBeenCalledTimes';

    let pass: boolean;
    let matcherResult: { actual: number } | undefined;

    await sleep(wait);
    let remainingTime = timeout;
    do {
      try {
        test.expect(fn.callCount).toBe(expected);
        pass = true;
        break;
      } catch {
        matcherResult = { actual: fn.callCount };
        pass = false;
        remainingTime -= 500;
        await sleep(500);
      }
    } while (remainingTime > 0);

    return {
      name: assertionName,
      pass,
      expected,
      actual: matcherResult?.actual,
      message: defaultMessage(
        this,
        assertionName,
        pass,
        expected,
        matcherResult,
      ),
    };
  },

  async toHaveBeenLastCalledWithMatching(
    fn: SpyFn,
    expected: Record<string, unknown>,
    { timeout = 5000, wait = 1000 }: { timeout?: number; wait?: number } = {},
  ) {
    const assertionName = 'toHaveBeenLastCalledWithMatching';

    let pass: boolean;
    let matcherResult: { actual: unknown } | undefined;

    await sleep(wait);
    let remainingTime = timeout;
    do {
      try {
        // we only support matching first argument of last call
        const lastCallArg = fn.calls[fn.calls.length - 1][0];
        test.expect(lastCallArg).toMatchObject(expected);
        pass = true;
        break;
      } catch {
        matcherResult = { actual: fn.calls[fn.calls.length - 1]?.[0] };
        pass = false;
        remainingTime -= 500;
        await sleep(500);
      }
    } while (remainingTime > 0);

    return {
      name: assertionName,
      pass,
      expected,
      actual: matcherResult?.actual,
      message: defaultMessage(
        this,
        assertionName,
        pass,
        expected,
        matcherResult,
      ),
    };
  },
});
