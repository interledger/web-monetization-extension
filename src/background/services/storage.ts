import type {
  AmountValue,
  GrantDetails,
  Storage,
  StorageKey,
  WalletAmount
} from '@/shared/types'
import { type Browser } from 'webextension-polyfill'
import { EventsService } from './events'
import { DebounceWithQueue } from '@/shared/helpers'
import { computeBalance } from '../utils'

const defaultStorage = {
  /**
   * For migrations, increase this version and add a migration script in
   * {@linkcode MIGRATIONS}. New additions to structure that can be dynamically
   * set don't need migrations (e.g. we check if value is null etc.) but other
   * structural changes would need migrations for keeping compatibility with
   * existing installations.
   */
  version: 2,
  state: null,
  connected: false,
  enabled: true,
  exceptionList: {},
  walletAddress: null,
  recurringGrant: null,
  recurringGrantSpentAmount: '0',
  oneTimeGrant: null,
  oneTimeGrantSpentAmount: '0',
  rateOfPay: null,
  minRateOfPay: null,
  maxRateOfPay: null
} satisfies Omit<Storage, 'publicKey' | 'privateKey' | 'keyId'>

export class StorageService {
  private setSpentAmountRecurring: DebounceWithQueue<[amount: string]>
  private setSpentAmountOneTime: DebounceWithQueue<[amount: string]>

  constructor(
    private browser: Browser,
    private events: EventsService
  ) {
    const bigIntMax = (a: string, b: string) => (BigInt(a) > BigInt(b) ? a : b)
    this.setSpentAmountRecurring = new DebounceWithQueue(
      (amount: string) => this.set({ recurringGrantSpentAmount: amount }),
      (args) => [args.reduce((max, [v]) => bigIntMax(max, v), '0')],
      1000
    )
    this.setSpentAmountOneTime = new DebounceWithQueue(
      (amount: string) => this.set({ oneTimeGrantSpentAmount: amount }),
      (args) => [args.reduce((max, [v]) => bigIntMax(max, v), '0')],
      1000
    )
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

  // TODO: ensure correct transitions between states, while also considering
  // race conditions.
  async setState(
    state: null | Record<Exclude<Storage['state'], null>, boolean>
  ): Promise<boolean> {
    const { state: prevState } = await this.get(['state'])

    let newState: Storage['state'] = null
    if (state !== null) {
      if (typeof state.missing_host_permissions === 'boolean') {
        if (state.missing_host_permissions) {
          newState = 'missing_host_permissions'
        }
      }
    }

    if (prevState === newState) {
      return false
    }

    await this.set({ state: newState })
    this.events.emit('storage.state_update', {
      state: newState,
      prevState: prevState
    })
    return true
  }

  setSpentAmount(grant: GrantDetails['type'], amount: string) {
    if (grant === 'recurring') {
      this.setSpentAmountRecurring.enqueue(amount)
    } else if (grant === 'one-time') {
      this.setSpentAmountOneTime.enqueue(amount)
    }
  }

  async getBalance(): Promise<{
    recurring: AmountValue
    oneTime: AmountValue
    total: AmountValue
  }> {
    const data = await this.get([
      'recurringGrant',
      'recurringGrantSpentAmount',
      'oneTimeGrant',
      'oneTimeGrantSpentAmount'
    ])
    const balanceRecurring = computeBalance(
      data.recurringGrant,
      data.recurringGrantSpentAmount
    )
    const balanceOneTime = computeBalance(
      data.oneTimeGrant,
      data.oneTimeGrantSpentAmount
    )
    const balance = balanceRecurring + balanceOneTime
    return {
      total: balance.toString(),
      recurring: balanceRecurring.toString(),
      oneTime: balanceOneTime.toString()
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

// There was never a migration to reach 1.
//
// In future, we may remove older version migrations as unsupported. That would
// require user to reinstall and setup extension from scratch.
const MIGRATIONS: Record<Storage['version'], Migration> = {
  2: (data) => {
    const deleteKeys = ['amount', 'token', 'grant', 'hasHostPermissions']

    data.recurringGrant = null
    data.recurringGrantSpentAmount = '0'
    data.oneTimeGrant = null
    data.oneTimeGrantSpentAmount = '0'
    data.state = null

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
      } else {
        data.oneTimeGrant = grantDetails
      }
    }

    if (data.hasHostPermissions === false) {
      data.state = 'missing_host_permissions' satisfies Storage['state']
    }

    return [data, deleteKeys]
  }
}
