import type {
  GrantDetails,
  Storage,
  StorageKey,
  WalletAmount
} from '@/shared/types'
import { type Browser } from 'webextension-polyfill'
import { EventsService } from './events'

const defaultStorage = {
  version: 2,
  connected: false,
  enabled: true,
  hasHostPermissions: true,
  exceptionList: {},
  walletAddress: null,
  recurringGrant: null,
  recurringGrantRemainingBalance: null,
  oneTimeGrant: null,
  oneTimeGrantRemainingBalance: null,
  rateOfPay: null,
  minRateOfPay: null,
  maxRateOfPay: null
} satisfies Omit<Storage, 'publicKey' | 'privateKey' | 'keyId'>

export class StorageService {
  constructor(
    private browser: Browser,
    private events: EventsService
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

  /**
   * Migrate storage to given target version.
   */
  async migrate(targetVersion: Storage['version'] = defaultStorage.version) {
    const storage = this.browser.storage.local

    let { version = 1 } = await this.get(['version'])
    if (version === targetVersion) {
      return null
    }

    let data = await storage.get()
    while (version < targetVersion) {
      ++version
      const migrate = MIGRATIONS[version]
      if (!migrate) {
        throw new Error(`No migration available to reach version "${version}"`)
      }
      const [newData, deleteKeys = []] = migrate(data)
      data = { ...newData, version }
      await storage.set(data)
      await storage.remove(deleteKeys)
    }
    return data as Storage
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

  async setHostPermissionStatus(status: boolean): Promise<void> {
    const { hasHostPermissions } = await this.get(['hasHostPermissions'])
    if (hasHostPermissions !== status) {
      await this.set({ hasHostPermissions: status })
      this.events.emit('storage.host_permissions_update', { status })
    }
  }

  async updateRate(rate: string): Promise<void> {
    await this.set({ rateOfPay: rate })
    this.events.emit('storage.rate_of_pay_update', { rate })
  }
}

/**
 * @param existingData Existing data from previous version.
 */
type Migration = (
  existingData: Record<string, any>
) => [data: Record<string, any>, deleteKeys?: string[]]

const MIGRATIONS: Record<Storage['version'], Migration> = {
  // There was never a migration to reach 1.
  //
  // In future, we may remove older version migrations as unsupported. That
  // would require user to reinstall and setup extension from scratch.
  2: (data) => {
    const deleteKeys = ['amount', 'token', 'grant']

    data.recurringGrant = null
    data.recurringGrantRemainingBalance = null
    data.oneTimeGrant = null
    data.oneTimeGrantRemainingBalance = null

    if (data.amount?.value && data.token && data.grant) {
      const type = data.amount.interval ? 'recurring' : 'one-time'

      const grantDetails: GrantDetails = {
        type,
        amount: {
          value: data.amount.value as string,
          ...(type === 'recurring'
            ? { interval: data.amount.interval as string }
            : {})
        } as Required<WalletAmount>,
        accessToken: {
          value: data.token.value as string,
          manageUrl: data.token.manage as string
        },
        continue: {
          url: data.grant.continueUri as string,
          accessToken: data.grant.accessToken as string
        }
      }

      if (type === 'recurring') {
        data.recurringGrant = grantDetails
        data.recurringGrantRemainingBalance = data.amount.value
      } else {
        data.oneTimeGrant = grantDetails
        data.oneTimeGrantRemainingBalance = data.amount.value
      }
    }
    return [data, deleteKeys]
  }
}
