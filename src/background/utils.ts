import type { AmountValue, GrantDetails, WalletAmount } from '@/shared/types'
import type { Browser, Runtime, Tabs } from 'webextension-polyfill'
import { DEFAULT_SCALE, EXCHANGE_RATES_URL } from './config'
import { notNullOrUndef } from '@/shared/helpers'

export const getCurrentActiveTab = async (browser: Browser) => {
  const window = await browser.windows.getLastFocused()
  const activeTabs = await browser.tabs.query({
    active: true,
    windowId: window.id
  })
  return activeTabs[0]
}

interface ToAmountParams {
  value: string
  recurring: boolean
  assetScale: number
}

export const toAmount = ({
  value,
  recurring,
  assetScale
}: ToAmountParams): WalletAmount => {
  const interval = `R/${new Date().toISOString()}/P1M`

  return {
    value: Math.floor(parseFloat(value) * 10 ** assetScale).toString(),
    ...(recurring ? { interval } : {})
  }
}

export const OPEN_PAYMENTS_ERRORS: Record<string, string> = {
  'invalid client':
    'Please make sure that you uploaded the public key for your desired wallet address.'
}

export interface GetRateOfPayParams {
  rate: string
  exchangeRate: number
  assetScale: number
}

export const getRateOfPay = ({
  rate,
  exchangeRate,
  assetScale
}: GetRateOfPayParams) => {
  const scaleDiff = assetScale - DEFAULT_SCALE

  if (exchangeRate < 0.8 || exchangeRate > 1.5) {
    const scaledExchangeRate = (1 / exchangeRate) * 10 ** scaleDiff
    return BigInt(Math.round(Number(rate) * scaledExchangeRate)).toString()
  }

  return (Number(rate) * 10 ** scaleDiff).toString()
}

interface ExchangeRates {
  base: string
  rates: Record<string, number>
}

export const getExchangeRates = async (): Promise<ExchangeRates> => {
  const response = await fetch(EXCHANGE_RATES_URL)
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

export const getTabId = (sender: Runtime.MessageSender): number => {
  return notNullOrUndef(notNullOrUndef(sender.tab, 'sender.tab').id, 'tab.id')
}

export const getTab = (sender: Runtime.MessageSender): Tabs.Tab => {
  return notNullOrUndef(notNullOrUndef(sender.tab, 'sender.tab'), 'tab')
}

export const getSender = (sender: Runtime.MessageSender) => {
  const tabId = getTabId(sender)
  const frameId = notNullOrUndef(sender.frameId, 'sender.frameId')

  return { tabId, frameId, url: sender.url }
}

export const computeRate = (rate: string, sessionsCount: number): AmountValue =>
  (BigInt(rate) / BigInt(sessionsCount)).toString()

export function computeBalance(
  grant?: GrantDetails | null,
  grantSpentAmount?: AmountValue | null
) {
  if (!grant?.amount) return 0n
  const total = BigInt(grant.amount.value)
  return grantSpentAmount ? total - BigInt(grantSpentAmount) : total
}

// USD Scale 9 (connected wallet)
// EUR Scale 2 (page)
// MIN_SEND_AMOUNT = 0.01 EUR * 10 ** (9 (Scale) - 2 (scale))
export function* getNextSendableAmount(
  senderAssetScale: number,
  receiverAssetScale: number,
  amount: bigint = 0n
): IterableIterator<AmountValue> {
  const EXPONENTIAL_INCREASE = 0.5

  const scaleDiff =
    senderAssetScale < receiverAssetScale
      ? 0
      : senderAssetScale - receiverAssetScale
  const base = 1n * 10n ** BigInt(scaleDiff)

  if (amount) {
    yield amount.toString()
  }

  let exp = 0
  while (true) {
    amount += base * BigInt(Math.floor(Math.exp(exp)))
    yield amount.toString()
    exp += EXPONENTIAL_INCREASE
  }
}
