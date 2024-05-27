import { Logger } from '@/shared/logger'
import type { PopupStore, Storage, StorageKey } from '@/shared/types'
import { type Browser } from 'webextension-polyfill'
import { getCurrentActiveTab } from '../utils'
import { EventsService } from './events'

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

// TODO: Emit events when certain values are updated:
// Eg:
// - rate of pay - we should recalculate the amount for every payment session
// - enabling/disabling WM
export class StorageService {
  constructor(
    private browser: Browser,
    private events: EventsService,
  ) {
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
    let url: string | undefined
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

    const tab = await getCurrentActiveTab(this.browser)

    if (tab && tab.url) {
      try {
        const tabUrl = new URL(tab.url)
        if (tabUrl.protocol === 'https:') {
          // Do not include search params
          url = `${tabUrl.origin}${tabUrl.pathname}`
        }
      } catch (_) {
        // noop
      }
    }

    return { ...data, url }
  }

  async getWMState(): Promise<boolean> {
    const { enabled } = await this.get(['enabled'])

    return enabled
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

  async updateRate(rate: string): Promise<void> {
    await this.set({ rateOfPay: rate })
  }
}
