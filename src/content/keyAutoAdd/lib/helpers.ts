// cSpell:ignore locationchange
/* eslint-disable @typescript-eslint/no-empty-object-type */

import { withResolvers } from '@/shared/helpers';

interface WaitForOptions {
  timeout: number;
}

interface WaitForElementOptions extends WaitForOptions {
  root: HTMLElement | HTMLHtmlElement | Document;
}

export function waitForElement<T extends HTMLElement = HTMLElement>(
  selector: string,
  { root = document, timeout = 10 * 1000 }: Partial<WaitForElementOptions> = {},
): Promise<T> {
  const { resolve, reject, promise } = withResolvers<T>();
  if (document.querySelector(selector)) {
    resolve(document.querySelector<T>(selector)!);
    return promise;
  }

  const abortSignal = AbortSignal.timeout(timeout);
  abortSignal.addEventListener('abort', (e) => {
    observer.disconnect();
    reject(e);
  });

  const observer = new MutationObserver(() => {
    const el = document.querySelector<T>(selector);
    if (el) {
      observer.disconnect();
      resolve(el);
    }
  });

  observer.observe(root, { childList: true, subtree: true });

  return promise;
}

interface WaitForURLOptions extends WaitForOptions {}

export async function waitForURL(
  match: (url: URL) => boolean,
  { timeout = 10 * 1000 }: Partial<WaitForURLOptions> = {},
) {
  const { resolve, reject, promise } = withResolvers<boolean>();

  if (match(new URL(window.location.href))) {
    resolve(true);
    return promise;
  }

  const abortSignal = AbortSignal.timeout(timeout);
  abortSignal.addEventListener('abort', (e) => {
    observer.disconnect();
    reject(e);
  });

  let url = window.location.href;
  // There's no stable 'locationchange' event, so we assume there's a chance
  // when the DOM changes, the URL might have changed too, and we make our URL
  // test then.
  const observer = new MutationObserver(() => {
    if (window.location.href === url) return;
    url = window.location.href;
    if (match(new URL(url))) {
      observer.disconnect();
      resolve(false);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return promise;
}

export function isTimedOut(e: any) {
  return (
    e instanceof Event &&
    e.type === 'abort' &&
    e.currentTarget instanceof AbortSignal &&
    e.currentTarget.reason?.name === 'TimeoutError'
  );
}
