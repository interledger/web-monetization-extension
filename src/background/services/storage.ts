import { DEFAULT_AMOUNT } from '@/background/config'
import { Logger } from '@/shared/logger'
import type {
  PopupState,
  Storage,
  StorageKey,
  WebsiteData
} from '@/shared/types'
import { type Browser } from 'webextension-polyfill'

const defaultStorage = {
  connected: false,
  enabled: true,
  exceptionList: {},
  publicKey: '',
  privateKey: '',
  keyId: '',
  walletAddress: undefined,
  amount: undefined,
  token: undefined
} satisfies Storage

export class StorageService {
  constructor(
    private browser: Browser,
    private logger: Logger
  ) {}

  async get<TKey extends StorageKey>(
    keys: TKey[]
  ): Promise<{ [Key in TKey[][number]]: Storage[Key] }> {
    const data = await this.browser.storage.local.get(keys)
    return data as { [Key in TKey[][number]]: Storage[Key] }
  }

  async getAll(): Promise<Storage> {
    const keys = Object.keys(defaultStorage) as StorageKey[]
    const data = await this.get(keys)
    return data
  }

  async set<TKey extends StorageKey>(data: {
    [K in TKey]: Storage[TKey]
  }): Promise<void> {
    await this.browser.storage.local.set(data)
  }

  async clear(): Promise<void> {
    await this.browser.storage.local.clear()
  }

  async populate(): Promise<void> {
    const data = await this.get(Object.keys(defaultStorage) as StorageKey[])

    if (Object.keys(data).length === 0) {
      await this.set(defaultStorage)
    }
  }

  async getPopupData(): Promise<PopupState> {
    const [{ url: tabUrl }] = await this.browser.tabs.query({
      active: true,
      currentWindow: true
    })
    const data = await this.getAll()

    let website: WebsiteData = {
      url: '',
      amount: { value: 0 }
    }

    if (!tabUrl) {
      website = {
        url: '',
        amount: { value: 0 }
      }
    } else {
      let url = ''
      try {
        const parsedUrl = new URL(tabUrl)
        url = `${parsedUrl.origin}${parsedUrl.pathname}`
      } catch (e) {
        /** noop */
      }

      website.url = url
      website.amount = data.exceptionList[url] ?? { value: DEFAULT_AMOUNT }
    }

    return {
      enabled: data.enabled,
      connected: data.connected,
      walletAddress: data.walletAddress,
      publicKey: data.publicKey,
      website
    }
  }

  async keyPairExists(): Promise<boolean> {
    const keys = await this.get(['privateKey', 'publicKey', 'keyId'])
    if (
      keys.privateKey &&
      typeof keys.privateKey === 'string' &&
      keys.publicKey &&
      typeof keys.publicKey === 'string' &&
      keys.keyId &&
      typeof keys.keyId === 'string'
    ) {
      return true
    }

    return false
  }
}
