import { isBefore } from 'date-fns/isBefore';
import { type Duration, parse } from 'iso8601-duration';
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
    this.throttled = throttle(() => this.flush(), wait, {
      leading: false,
      trailing: true,
    });
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
  const duration = parse(match[3]);

  // Like the wallet, each occurrence is the previous one plus the duration.
  let date = startDate;
  for (let i = 0; !isBefore(base, date); i++) {
    if (count && i >= count) {
      throw new Error('No next occurrence is possible beyond given time');
    }
    date = addDuration(date, duration);
  }

  return date;
};

/**
 * Add an ISO 8601 duration to a date, in UTC. Same as the wallet (Rafiki, via
 * luxon), the day is clamped to the resulting month, so Jan 31 + P1M is the
 * last day of February, not a date in March.
 */
function addDuration(date: Date, duration: Duration): Date {
  const {
    years = 0,
    months = 0,
    weeks = 0,
    days = 0,
    hours = 0,
    minutes = 0,
    seconds = 0,
  } = duration;
  const result = new Date(date);

  const dayOfMonth = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCFullYear(
    result.getUTCFullYear() + years,
    result.getUTCMonth() + months,
  );
  const daysInMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(dayOfMonth, daysInMonth) + weeks * 7 + days);

  result.setTime(
    result.getTime() + ((hours * 60 + minutes) * 60 + seconds) * 1000,
  );
  return result;
}
