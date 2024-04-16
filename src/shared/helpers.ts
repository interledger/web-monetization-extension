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

interface ExchangeRates {
  base: string
  rates: Record<string, number>
}

export const getExchangeRates = async (): Promise<ExchangeRates> => {
  const response = await fetch(
    'https://telemetry-exchange-rates.s3.amazonaws.com/exchange-rates-usd.json'
  )
  if (!response.ok) {
    throw new Error(
      `Could not fetch exchange rates. [Status code: ${response.status}]`
    )
  }
  const rates = await response.json()
  if (!rates.base || !rates.rates) {
    throw new Error('Invalid rates format')
  }

  return rates
}
