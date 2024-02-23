import browser from 'webextension-polyfill'

import { TPopupContext } from '@/providers/providers.interface'
import { sendMessage } from '@/utils/sendMessages'

export interface ExtensionStorageData {
  amount: number
  amountType: {
    recurring: boolean
  }
  rateOfPay: number
  wmEnabled: boolean
  accessTokenQuote: string
  accessTokenOutgoing: string
  refreshToken: string
  manageUrl: string
}

export const defaultData: ExtensionStorageData = {
  amount: 0,
  amountType: {
    recurring: true,
  },
  rateOfPay: 0.36,
  wmEnabled: true,
  accessTokenQuote: '',
  accessTokenOutgoing: '',
  refreshToken: '',
  manageUrl: '',
}

export const getStorageData = async () => {
  try {
    const response = await sendMessage({ type: 'GET_STORAGE_DATA' })
    return response?.data as TPopupContext
  } catch (error) {
    console.error('Error fetching storage data:', error)
    return null
  }
}

export const storageApi = browser.storage?.sync || browser.storage?.local
