import { WalletAddress } from '@interledger/open-payments/dist/types'

/** Wallet amount */
export interface WalletAmount {
  value: string
  /** https://en.wikipedia.org/wiki/ISO_8601#Repeating_intervals */
  interval?: string
}

/** Amount interface - used in the `exceptionList` */
export interface Amount {
  value: string
  interval: number
}

export interface AccessToken {
  value: string
  manageUrl: string
}

interface GrantDetailsBase {
  type: string
  accessToken: AccessToken
  continue: { url: string; accessToken: string }
}
export interface OneTimeGrant extends GrantDetailsBase {
  type: 'one-time'
  amount: Omit<WalletAmount, 'interval'>
}
export interface RecurringGrant extends GrantDetailsBase {
  type: 'recurring'
  amount: Required<WalletAmount>
}
export type GrantDetails = OneTimeGrant | RecurringGrant

/** Bigint amount, before transformation with assetScale */
type AmountValue = string

export interface Storage {
  /**
   * Storage structure version. Used in migrations. Numbers are sequential.
   * Inspired by database upgrades in IndexedDB API.
   */
  version: number

  /** If web monetization is enabled */
  enabled: boolean
  /** If a wallet is connected or not */
  connected: boolean
  /** Extension state */
  state:
    | never // just added for code formatting
    /** Normal */
    | null
    /** Extension can't inject scripts and fetch resources from all hosts */
    | 'missing_host_permissions'

  rateOfPay?: string | undefined | null
  minRateOfPay?: string | undefined | null
  maxRateOfPay?: string | undefined | null

  /** User wallet address information */
  walletAddress?: WalletAddress | undefined | null

  recurringGrant?: RecurringGrant | undefined | null
  recurringGrantRemainingBalance?: AmountValue | undefined | null
  oneTimeGrant?: OneTimeGrant | undefined | null
  oneTimeGrantRemainingBalance?: AmountValue | undefined | null

  /** Exception list with websites and each specific amount */
  exceptionList: {
    [website: string]: Amount
  }
  /** Key information */
  publicKey: string
  privateKey: string
  keyId: string
}
export type StorageKey = keyof Storage

export type PopupStore = Omit<
  Storage,
  | 'version'
  | 'privateKey'
  | 'keyId'
  | 'exceptionList'
  | 'recurringGrant'
  | 'oneTimeGrant'
> & {
  isSiteMonetized: boolean
  url: string | undefined
}

export type DeepNonNullable<T> = {
  [P in keyof T]?: NonNullable<T[P]>
}
