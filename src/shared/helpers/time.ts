import { addSeconds } from 'date-fns/addSeconds';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
import { parse, toSeconds } from 'iso8601-duration';
import type { RepeatingInterval } from '../types';

export const sleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

export function debounceAsync<T extends unknown[], R extends Promise<unknown>>(
  func: (...args: T) => R,
  wait: number,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: T) =>
    new Promise<Awaited<R>>((resolve) => {
      if (timeout != null) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void Promise.resolve(func(...args)).then(resolve);
      }, wait);
    });
}

// Based on https://stackoverflow.com/a/27078401
export function throttle<T extends unknown[], R>(
  func: (...args: T) => R,
  wait: number,
  {
    leading = false,
    trailing = false,
  }: Partial<{ leading: boolean; trailing: boolean }> = {},
) {
  let result: R;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let previous = 0;
  const later = (...args: T) => {
    previous = leading === false ? 0 : Date.now();
    timeout = null;
    result = func(...args);
  };
  return (...args: T) => {
    const now = Date.now();
    if (!previous && leading === false) previous = now;
    const remaining = wait - (now - previous);
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func(...args);
    } else if (!timeout && trailing !== false) {
      timeout = setTimeout(later, remaining, ...args);
    }
    return result;
  };
}

/**
 * Throttle a function, while allowing the queued arguments to be reduced before
 * the function is called. With args reducer, we can call the throttled function
 * with first/last/merged arguments etc.
 *
 * @example
 * ```ts
 * const throttled = new ThrottleBatch(
 *   (total: number) => saveToStorage({ total: total.toString() }),
 *   (collectedArgs) => [collectedArgs.reduce(total, [val] => total + val, 0)],
 *   wait
 * )
 * throttled.enqueue(10)
 * throttled.enqueue(15)
 * // results in saveToStorage(25)
 * ```
 */
export class ThrottleBatch<Args extends unknown[], R = unknown> {
  private argsList: Args[] = [];
  private throttled: () => void;

  constructor(
    private func: (...arg: Args) => R,
    private argsReducer: (args: Args[]) => [...Args],
    wait: number,
  ) {
    this.throttled = throttle(() => this.flush(), wait, { leading: true });
  }

  enqueue(...data: Args) {
    this.argsList.push(data);
    void this.throttled();
  }

  flush() {
    if (!this.argsList.length) return;
    const args = this.argsReducer(this.argsList.slice());
    this.argsList = [];
    return this.func(...args);
  }
}

export function debounceSync<T extends unknown[], R>(
  func: (...args: T) => R,
  wait: number,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: T) =>
    new Promise<R>((resolve) => {
      if (timeout != null) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        resolve(func(...args));
      }, wait);
    });
}

export class Timeout {
  private callback: () => void;
  #timeout: ReturnType<typeof setTimeout> | null = null;
  #isPaused = false;
  #lastCalledAt = 0;
  #remaining = 0;

  constructor(
    private ms: number,
    callback: () => void,
  ) {
    this.callback = () => {
      this.#lastCalledAt = Date.now();
      callback();
    };
    if (ms > 0) this.reset(ms);
  }

  reset(ms: number) {
    const lastCalledAt = this.#lastCalledAt;
    this.clear();
    this.ms = ms;
    this.#isPaused = false;
    this.#lastCalledAt = lastCalledAt;
    this.#timeout = setTimeout(this.callback, ms);
  }

  pause() {
    if (this.#isPaused) return;
    const lastCalledAt = this.#lastCalledAt;
    this.#remaining = lastCalledAt ? Date.now() - lastCalledAt : 0;
    this.clear();
    this.#lastCalledAt = lastCalledAt;
    this.#isPaused = true;
  }

  resume() {
    if (!this.#isPaused) return;
    if (this.#remaining > 0) {
      this.#timeout = setTimeout(() => {
        this.callback();
        this.reset(this.ms);
      }, this.#remaining);
    } else {
      this.reset(this.ms);
    }
  }

  clear() {
    if (this.#timeout === null) return;
    clearTimeout(this.#timeout);
    this.#timeout = null;
    this.#lastCalledAt = 0;
  }
}

/**
 * Check if `err` (reason) is result of `AbortSignal.timeout()`
 */
export const isAbortSignalTimeout = (err: unknown): err is DOMException => {
  return err instanceof DOMException && err.name === 'TimeoutError';
};

const REPEATING_INTERVAL_REGEX =
  /^R(\d*)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\/(P.+)$/;

export const getNextOccurrence = (
  interval: RepeatingInterval,
  base = new Date(),
): Date => {
  const match = interval.match(REPEATING_INTERVAL_REGEX);
  if (!match) {
    throw new Error(`Invalid interval: ${interval}`);
  }
  const count = match[1] ? Number.parseInt(match[1], 10) : null;
  const startDate = new Date(match[2]);
  const pattern = parse(match[3]);
  const seconds = toSeconds(pattern, base);

  if (count && isAfter(base, addSeconds(startDate, count * seconds))) {
    throw new Error('No next occurrence is possible beyond given time');
  }

  let date = new Date(startDate);
  while (!isBefore(base, date)) {
    date = addSeconds(date, seconds);
  }

  return date;
};
