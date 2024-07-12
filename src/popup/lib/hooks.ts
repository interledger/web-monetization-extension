import React from 'react'

/**
 * Store data in browser's local storage. Helpful in retrieving state after
 * popup closes.
 *
 * Can set a `maxAge` (in seconds, default 1000 days - AKA forever but not
 * Infinity) to avoid using state data. Stale data is cleared on access only.
 *
 * @note Don't call it too often to avoid performance issues, as it's
 * synchronous and calls JSON.stringify and JSON.parse APIs.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  { maxAge = 1000 * 24 * 60 * 60 }: Partial<{ maxAge: number }> = {}
) {
  const hasLocalStorage = typeof localStorage !== 'undefined'
  maxAge *= 1000

  type Stored = { value: T; expiresAt: number }
  const isWellFormed = React.useCallback((obj: any): obj is Stored => {
    if (typeof obj !== 'object' || obj == null) return false
    if (!obj.expiresAt || !Number.isSafeInteger(obj.expiresAt)) return false
    return typeof obj.value !== 'undefined'
  }, [])

  const [value, setValue] = React.useState<T>(() => {
    if (!hasLocalStorage) return defaultValue

    const storedValue = localStorage.getItem(key)
    if (!storedValue) return defaultValue

    try {
      const data = JSON.parse(storedValue)
      if (isWellFormed(data) && data.expiresAt > Date.now()) {
        return data.value
      } else {
        localStorage.removeItem(key)
      }
    } catch {
      // do nothing
    }
    return defaultValue
  })

  React.useEffect(() => {
    if (hasLocalStorage && value !== defaultValue) {
      const expiresAt = Date.now() + maxAge
      const data: Stored = { value, expiresAt }
      localStorage.setItem(key, JSON.stringify(data))
    }
  }, [value, key, defaultValue, maxAge, hasLocalStorage])

  const clearStorage = () => {
    if (hasLocalStorage) {
      localStorage.removeItem(key)
    }
  }

  return [value, setValue, clearStorage] as const
}
