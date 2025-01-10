// cSpell:ignore locationchange
import { withResolvers } from '@/shared/helpers';

interface WaitForOptions {
  timeout: number;
}

interface WaitForElementOptions extends WaitForOptions {
  root: HTMLElement | HTMLHtmlElement | Document;
  /**
   * Once a selector is matched, you can request an additional check to ensure
   * this is the element you're looking for.
   */
  match: (el: HTMLElement) => boolean;
}

export function waitForElement<T extends HTMLElement = HTMLElement>(
  selector: string,
  {
    root = document,
    timeout = 10 * 1000,
    match = () => true,
  }: Partial<WaitForElementOptions> = {},
): Promise<T> {
  const { resolve, reject, promise } = withResolvers<T>();
  if (document.querySelector(selector)) {
    resolve(document.querySelector<T>(selector)!);
    return promise;
  }

  const abortSignal = AbortSignal.timeout(timeout);
  abortSignal.addEventListener('abort', (e) => {
    observer.disconnect();
    reject(
      new TimeoutError(`Timeout waiting for element: {${selector}}`, {
        cause: e,
      }),
    );
  });

  const observer = new MutationObserver(() => {
    const el = document.querySelector<T>(selector);
    if (el && match(el)) {
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
    reject(new TimeoutError('Timeout waiting for URL', { cause: e }));
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

class TimeoutError extends Error {
  name = 'TimeoutError';
  constructor(message: string, { cause }: { cause: Event }) {
    super(message, { cause });
  }
}

export function isTimedOut(e: any) {
  return e instanceof TimeoutError;
}
