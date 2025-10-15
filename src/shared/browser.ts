import type { Browser } from 'webextension-polyfill';

/**
 * This is almost same as browser from webextension-polyfill, but without the
 * wrapper functions to support async message handler (i.e. we need to use
 * `sendResponse` callback). See https://stackoverflow.com/questions/44056271
 *
 * As the polyfill is helping us with that only, if we don't need async message
 * handler, use this instead of `browser` from `webextension-polyfill`.
 *
 * It'll reduce content script size by around 10KB, more meaningful when there's
 * multiple content scripts per page. So better for performance overall.
 */
// @ts-expect-error we know it may not exist, hence the test
const globalBrowser = globalThis.browser?.runtime?.id
  ? // @ts-expect-error we just verified above it exists
    (globalThis.browser as Browser)
  : // @ts-expect-error `chrome` API is same as Browser, just different type sources
    (globalThis.chrome as Browser);

export { globalBrowser as browser };

export default globalBrowser;

export type { Browser, Runtime } from 'webextension-polyfill';
