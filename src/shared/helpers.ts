import { SuccessResponse } from '@/shared/messages'
import { WalletAddress } from '@interledger/open-payments/dist/types'
import { cx, CxOptions } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'
import type { Browser } from 'webextension-polyfill'

export const cn = (...inputs: CxOptions) => {
  return twMerge(cx(inputs))
}

export const formatCurrency = (value: any): string => {
  if (value < 1) {
    return `${Math.round(value * 100)}c`
  } else {
    return `$${parseFloat(value).toFixed(2)}`
  }
}

const isWalletAddress = (o: any): o is WalletAddress => {
  return (
    o.id &&
    typeof o.id === 'string' &&
    o.assetScale &&
    typeof o.assetScale === 'number' &&
    o.assetCode &&
    typeof o.assetCode === 'string' &&
    o.authServer &&
    typeof o.authServer === 'string' &&
    o.resourceServer &&
    typeof o.resourceServer === 'string'
  )
}

export const getWalletInformation = async (
  walletAddressUrl: string
): Promise<WalletAddress> => {
  const response = await fetch(walletAddressUrl, {
    headers: {
      Accept: 'application/json'
    }
  })
  const json = await response.json()

  if (!isWalletAddress(json)) {
    throw new Error('Invalid wallet address response.')
  }

  return json
}

export const success = <TPayload = undefined>(
  payload: TPayload
): SuccessResponse<TPayload> => ({
  success: true,
  payload
})

export const failure = (message: string) => ({
  success: false,
  message
})

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const notNullOrUndef = <T>(
  t: T | null | undefined,
  name = '<unknown>'
): T | never => {
  if (t == null) {
    throw new Error(`Expecting not null for ${name}`)
  } else {
    return t
  }
}

export function debounceAsync<T extends unknown[], R extends Promise<unknown>>(
  func: (...args: T) => R,
  wait: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return function (...args: T) {
    return new Promise<Awaited<R>>((resolve) => {
      if (timeout != null) clearTimeout(timeout)
      timeout = setTimeout(() => {
        timeout = null
        void Promise.resolve(func(...args)).then(resolve)
      }, wait)
    })
  }
}

// Based on https://stackoverflow.com/a/27078401
export function throttle<T extends unknown[], R>(
  func: (...args: T) => R,
  wait: number,
  options: Partial<{ leading: boolean; trailing: boolean }> = {
    leading: false,
    trailing: false
  }
) {
  let result: R
  let timeout: ReturnType<typeof setTimeout> | null = null
  let previous = 0
  const later = (...args: T) => {
    previous = options.leading === false ? 0 : Date.now()
    timeout = null
    result = func(...args)
  }
  return (...args: T) => {
    const now = Date.now()
    if (!previous && options.leading === false) previous = now
    const remaining = wait - (now - previous)
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      result = func(...args)
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining, ...args)
    }
    return result
  }
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
  private argsList: Args[] = []
  private throttled: () => void

  constructor(
    private func: (...arg: Args) => R,
    private argsReducer: (args: Args[]) => [...Args],
    wait: number
  ) {
    this.throttled = throttle(() => this.flush(), wait, { leading: true })
  }

  enqueue(...data: Args) {
    this.argsList.push(data)
    void this.throttled()
  }

  flush() {
    if (!this.argsList.length) return
    const args = this.argsReducer(this.argsList.slice())
    this.argsList = []
    return this.func(...args)
  }
}

export function debounceSync<T extends unknown[], R>(
  func: (...args: T) => R,
  wait: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return function (...args: T) {
    return new Promise<R>((resolve) => {
      if (timeout != null) clearTimeout(timeout)
      timeout = setTimeout(() => {
        timeout = null
        resolve(func(...args))
      }, wait)
    })
  }
}

export function convert(value: bigint, source: number, target: number) {
  const scaleDiff = target - source
  if (scaleDiff > 0) {
    return value * BigInt(Math.pow(10, scaleDiff))
  }
  return value / BigInt(Math.pow(10, -scaleDiff))
}

export function bigIntMax(a: string, b: string) {
  return BigInt(a) > BigInt(b) ? a : b
}

type TranslationKeys = keyof typeof import('../_locales/en/messages.json')

export type Translation = ReturnType<typeof tFactory>
export function tFactory(browser: Pick<Browser, 'i18n'>) {
  /**
   * Helper over calling cumbersome `this.browser.i18n.getMessage(key)` with
   * added benefit that it type-checks if key exists in message.json
   */
  return <T extends TranslationKeys>(
    key: T,
    substitutions?: string | string[]
  ) => browser.i18n.getMessage(key, substitutions)
}

type Primitive = string | number | boolean | null | undefined

// Warn: Not a nested object equals or a deepEquals function
export function objectEquals<T extends Record<string, Primitive>>(a: T, b: T) {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  return JSON.stringify(a, keysA.sort()) === JSON.stringify(b, keysB.sort())
}
