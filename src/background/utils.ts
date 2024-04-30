import { WalletAmount } from '@/shared/types'
import { type Browser, action, runtime, Runtime } from 'webextension-polyfill'
import { DEFAULT_SCALE, EXCHANGE_RATES_URL } from './config'
import { notNullOrUndef } from '@/shared/helpers'

const iconActive34 = runtime.getURL('assets/icons/icon-active-34.png')
const iconActive128 = runtime.getURL('assets/icons/icon-active-128.png')
const iconInactive34 = runtime.getURL('assets/icons/icon-inactive-34.png')
const iconInactive128 = runtime.getURL('assets/icons/icon-inactive-128.png')

export const updateIcon = async (active: boolean) => {
  const iconData = {
    '34': active ? iconActive34 : iconInactive34,
    '128': active ? iconActive128 : iconInactive128
  }

  if (action) {
    await action.setIcon({ path: iconData })
  } else if (chrome.browserAction) {
    chrome.browserAction.setIcon({ path: iconData })
  }
}

export const getCurrentActiveTabId = async (browser: Browser) => {
  const activeTabs = await browser.tabs.query({
    active: true,
    currentWindow: true
  })
  return activeTabs[0].id
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

export const getSender = (sender: Runtime.MessageSender) => {
  const tabId = getTabId(sender)
  const frameId = notNullOrUndef(sender.frameId, 'sender.frameId')
  return { tabId, frameId }
}
