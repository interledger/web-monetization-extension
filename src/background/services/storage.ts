import { Logger } from '@/shared/logger'
import type {
  PopupStore,
  Storage,
  StorageKey,
  WebsiteData
} from '@/shared/types'
import EventEmitter from 'events'
import { type Browser } from 'webextension-polyfill'

const defaultStorage = {
  connected: false,
  enabled: true,
  exceptionList: {},
  walletAddress: null,
  amount: null,
  token: null,
  grant: null,
  rateOfPay: null,
  minRateOfPay: null,
  maxRateOfPay: null
} satisfies Omit<Storage, 'publicKey' | 'privateKey' | 'keyId'>

export class StorageService extends EventEmitter {
  constructor(
    private browser: Browser,
    private logger: Logger
  ) {
    super()
  }

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

  // TODO: Exception list (post-v1) - return data for the current website
  async getPopupData(): Promise<PopupStore> {
    const data = await this.get([
      'enabled',
      'connected',
      'amount',
      'rateOfPay',
      'minRateOfPay',
      'maxRateOfPay',
      'walletAddress',
      'publicKey'
    ])

    return data
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

  test() {
    this.emit('rate-update')
  }
}
