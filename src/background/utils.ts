import { WalletAmount } from '@/shared/types'
import browser, { type Browser, action, runtime } from 'webextension-polyfill'

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
  return {
    value: Math.floor(parseFloat(value) * 10 ** assetScale).toString(),
    // TODO: Create repeating interval
    ...(recurring ? { interval: new Date().toISOString() } : {})
  }
}

export const OPEN_PAYMENTS_ERRORS: Record<string, string> = {
  'invalid client':
    'Please make sure that you uploaded the public key for your desired wallet address.'
}
