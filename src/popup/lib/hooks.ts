import React from 'react';
import { throttle } from '@/shared/helpers';

/**
 * Store data in browser's local storage. Helpful in retrieving state after
 * popup closes.
 *
 * Can set a `maxAge` (in seconds, default 1000 days - AKA forever but not
 * Infinity) to avoid using stale data. Stale data is cleared on access only.
 *
 * @note Don't call it too often to avoid performance issues, as it's
 * synchronous and calls JSON.stringify and JSON.parse APIs.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  {
    maxAge = 1000 * 24 * 60 * 60,
    validate = () => true,
  }: Partial<{ maxAge: number; validate: (value: T) => boolean }> = {},
) {
  const hasLocalStorage = typeof localStorage !== 'undefined';
  maxAge *= 1000;

  type Stored = { value: T; expiresAt: number };
  const isWellFormed = React.useCallback((obj: any): obj is Stored => {
    if (typeof obj !== 'object' || obj == null) return false;
    if (!obj.expiresAt || !Number.isSafeInteger(obj.expiresAt)) return false;
    return typeof obj.value !== 'undefined';
  }, []);

  const [value, setValue] = React.useState<T>(() => {
    if (!hasLocalStorage) return defaultValue;

    const storedValue = localStorage.getItem(key);
    if (!storedValue) return defaultValue;

    try {
      const data = JSON.parse(storedValue);
      if (
        isWellFormed(data) &&
        data.expiresAt > Date.now() &&
        validate(data.value)
      ) {
        return data.value;
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
    return defaultValue;
  });

  React.useEffect(() => {
    if (!hasLocalStorage) return;
    const expiresAt = Date.now() + maxAge;
    const data: Stored = { value, expiresAt };
    localStorage.setItem(key, JSON.stringify(data));
  }, [value, key, defaultValue, maxAge, hasLocalStorage]);

  const clearStorage = () => {
    if (hasLocalStorage) {
      localStorage.removeItem(key);
    }
  };

  return [value, setValue, clearStorage] as const;
}

/**
 * Trigger a callback on long mouse press.
 * Example use case: increment/decrement counter while mouse is pressed.
 */
export function useLongPress(callback: () => void, ms = 100) {
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    intervalRef.current ??= setInterval(callback, ms);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  React.useEffect(() => stop, [callback, ms]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
  };
}

export const useThrottle: typeof throttle = (
  callback,
  delay,
  options = { leading: false, trailing: false },
) => {
  const cbRef = React.useRef(callback);
  React.useEffect(() => {
    cbRef.current = callback;
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback(throttle(cbRef.current, delay, options), [delay]);
};
