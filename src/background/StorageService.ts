import browser from 'webextension-polyfill'

export interface IStorageService {
  set(_key: string, _value: any): Promise<void>
  get(_key: string): Promise<any>
}

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

class StorageService {
  async get(key: string): Promise<ExtensionStorageData | undefined> {
    try {
      const result = await browser.storage.sync.get(key)
      return result[key] as ExtensionStorageData
    } catch (error) {
      throw new Error(`Error retrieving data: ${error}`)
    }
  }

  async set(key: string, value: ExtensionStorageData): Promise<void> {
    try {
      await browser.storage.sync.set({ [key]: value })
    } catch (error) {
      throw new Error(`Error saving data: ${error}`)
    }
  }
}

export default StorageService
