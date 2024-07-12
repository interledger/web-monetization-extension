import React from 'react'

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  { maxAge = Infinity }: Partial<{ maxAge: number }> = {}
) {
  const hasLocalStorage = typeof localStorage !== 'undefined'

  type Stored = { value: T; ts: number }
  const isWellFormed = React.useCallback((obj: any): obj is Stored => {
    if (typeof obj !== 'object' || obj == null) return false
    if (!obj.ts || !Number.isSafeInteger(obj.ts)) return false
    return typeof obj.value !== 'undefined'
  }, [])

  const [value, setValue] = React.useState<T>(() => {
    if (!hasLocalStorage) return defaultValue

    const storedValue = localStorage.getItem(key)
    if (!storedValue) return defaultValue

    try {
      const data = JSON.parse(storedValue)
      if (isWellFormed(data) && Date.now() - data.ts < maxAge * 1000) {
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
      const data: Stored = { value, ts: Date.now() }
      localStorage.setItem(key, JSON.stringify(data))
    }
  }, [value, key, defaultValue, hasLocalStorage])

  const clearStorage = () => {
    if (hasLocalStorage) {
      localStorage.removeItem(key)
    }
  }

  return [value, setValue, clearStorage] as const
}
