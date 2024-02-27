import browser from 'webextension-polyfill'

import { TPopupContext } from '@/providers/providers.interface'
import { sendMessage } from '@/utils/sendMessages'

export const defaultData: TPopupContext = {
  connected: false,
  wallet: '',
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

export const getStorageKey = async (key: string) => {
  const response: any = await sendMessage({ type: 'GET_STORAGE_KEY', data: key })
  return response?.[key]
}

export const storageApi = browser.storage?.sync || browser.storage?.local

export const setStorageDefaultData = async () => {
  try {
    await storageApi.set({ data: { ...defaultData } })
  } catch (error) {
    console.error('Error storing data:', error)
  }
}

export const getKeys = async (): Promise<boolean> =>  {
  const data = await storageApi.get(['privateKey', 'publicKey', 'keyId'])
  return data.privateKey && data.publicKey && data.keyId
}

export const setKeys = async(privateKey: string, publicKey: string, keyId: string): Promise<void> => {
  await storageApi.set({
    privateKey,
    publicKey,
    keyId,
  })
}