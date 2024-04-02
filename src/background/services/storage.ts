import { DEFAULT_AMOUNT, DEFAULT_INTERVAL_MS } from '@/background/config'
import { Logger } from '@/shared/logger'
import type {
  PopupStore,
  Storage,
  StorageKey,
  WebsiteData
} from '@/shared/types'
import { type Browser } from 'webextension-polyfill'

const defaultStorage = {
  connected: false,
  enabled: true,
  exceptionList: {},
  walletAddress: null,
  amount: null,
  token: null,
  grant: null,
} satisfies Omit<Storage, 'publicKey' | 'privateKey' | 'keyId'>

export class StorageService {
  constructor(
    private browser: Browser,
    private logger: Logger
  ) {}

  async get<TKey extends StorageKey>(
    keys?: TKey[]
  ): Promise<{ [Key in TKey[][number]]: Storage[Key] }> {
    const data = await this.browser.storage.local.get(keys)
    return data as { [Key in TKey[][number]]: Storage[Key] }
  }

  async set<TKey extends StorageKey>(data: {
    [K in TKey]: Storage[TKey]
  }): Promise<void> {
    await this.browser.storage.local.set(data)
  }

  async clear(): Promise<void> {
    await this.set(defaultStorage)
  }

  async populate(): Promise<void> {
    const data = await this.get(Object.keys(defaultStorage) as StorageKey[])

    if (Object.keys(data).length === 0) {
      await this.set(defaultStorage)
    }
  }

  async getPopupData(): Promise<PopupStore> {
    // TODO: Improve URL management
    const [{ url: tabUrl }] = await this.browser.tabs.query({
      active: true,
      currentWindow: true
    })
    const data = await this.get([
      'enabled',
      'connected',
      'amount',
      'exceptionList',
      'walletAddress',
      'publicKey'
    ])

    const website: WebsiteData = {
      url: '',
      amount: { value: '0', interval: DEFAULT_INTERVAL_MS }
    }

    if (tabUrl) {
      let url = ''
      try {
        const parsedUrl = new URL(tabUrl)
        if (parsedUrl.protocol !== 'https:') {
          throw new Error('Only https websites allowed')
        }
        url = `${parsedUrl.origin}${parsedUrl.pathname}`
      } catch (e) {
        this.logger.error(e.message)
        /** noop */
      }

      website.url = url
      if (data.exceptionList && data.exceptionList[url]) {
        website.amount = data.exceptionList[url]
      } else {
        website.amount = {
          value: DEFAULT_AMOUNT,
          interval: DEFAULT_INTERVAL_MS
        }
      }
    }

    return {
      enabled: data.enabled,
      connected: data.connected,
      amount: data.amount,
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
