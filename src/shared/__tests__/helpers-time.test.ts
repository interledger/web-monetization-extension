import { describe, expect, it, vi } from 'vitest';
import {
  debounceAsync,
  debounceSync,
  sleep,
  throttle,
  ThrottleBatch,
} from '../helpers/time';

vi.useFakeTimers();

describe('sleep', () => {
  it('resolves after the given ms', async () => {
    const spy = vi.fn();
    void sleep(100).then(spy);
    await vi.advanceTimersByTimeAsync(100);
    expect(spy).toHaveBeenCalled();
  });
});

describe('debounceAsync', () => {
  it('only invokes the underlying function once for calls within the wait window', async () => {
    const fn = vi.fn((x: number) => Promise.resolve(x * 2));
    const debounced = debounceAsync(fn, 100);
    // the first call's promise is superseded and never settles; only the
    // last call within the wait window resolves
    void debounced(1);
    const p2 = debounced(2);
    await vi.advanceTimersByTimeAsync(100);
    await expect(p2).resolves.toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);
  });
});

describe('throttle', () => {
  it('calls immediately when leading is true, then ignores calls within the window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100, { leading: true, trailing: false });
    throttled('a');
    throttled('b');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    vi.advanceTimersByTime(150);
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('collapses calls into a single trailing call when trailing is true', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100, { leading: false, trailing: true });
    throttled('a');
    throttled('b');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('clears a pending trailing timeout when a later call fires immediately instead', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100, { leading: false, trailing: true });
    throttled('a'); // schedules a trailing call
    expect(fn).not.toHaveBeenCalled();

    // jump the clock past `wait` without running the pending timer, so the
    // next call sees remaining <= 0 while the old timeout is still pending
    vi.setSystemTime(Date.now() + 200);
    throttled('b');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');

    // the cleared timeout must not also fire late with the stale 'a' args
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires a scheduled trailing call and keeps the clock running when leading is also true', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100, { leading: true, trailing: true });
    throttled('a'); // fires immediately (leading)
    throttled('b'); // schedules a trailing call
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100); // the trailing call fires naturally
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');

    // a further call right after is throttled again (previous was reset to
    // the trailing call's fire time, not to 0)
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('ThrottleBatch', () => {
  it('batches enqueued args and flushes the reduced result after wait', () => {
    const fn = vi.fn();
    const batch = new ThrottleBatch<[number], void>(
      fn,
      (argsList) => [argsList.reduce((sum, [n]) => sum + n, 0)],
      100,
    );
    batch.enqueue(10);
    batch.enqueue(15);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(25);
  });

  it('flush() is a no-op when nothing is queued', () => {
    const fn = vi.fn();
    const batch = new ThrottleBatch<[number], void>(
      fn,
      (argsList) => [argsList[0]?.[0] ?? 0],
      100,
    );
    batch.flush();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('debounceSync', () => {
  it('only invokes the underlying function once for calls within the wait window', async () => {
    const fn = vi.fn((x: number) => x * 2);
    const debounced = debounceSync(fn, 100);
    // the first call's promise is superseded and never settles; only the
    // last call within the wait window resolves
    void debounced(1);
    const p2 = debounced(2);
    await vi.advanceTimersByTimeAsync(100);
    await expect(p2).resolves.toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
