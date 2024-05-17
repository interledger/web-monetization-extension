import { SuccessResponse } from '@/shared/messages'
import { WalletAddress } from '@interledger/open-payments/dist/types'
import { cx, CxOptions } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

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
