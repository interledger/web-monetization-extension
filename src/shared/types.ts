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

export interface WebsiteData {
  url: string
  amount: Amount
}

export interface AccessToken {
  value: string
  manage: string
}

export interface GrantDetails {
  accessToken: string
  continueUri: string
}

export interface Storage {
  /** If web monetization is enabled */
  enabled: boolean
  /** If a wallet is connected or not */
  connected: boolean
  /** Wallet address url to be connected */
  walletAddressUrl?: string | undefined | null
  /** Amount value to be used */
  amountValue?: string | undefined | null
  /** If amount should be recurring  */
  recurring?: boolean

  rateOfPay?: string | undefined | null
  minRateOfPay?: string | undefined | null
  maxRateOfPay?: string | undefined | null

  /** User wallet address information */
  walletAddress?: WalletAddress | undefined | null
  /** Overall amount */
  amount?: WalletAmount | undefined | null
  /** Access token for quoting & outgoing payments  */
  token?: AccessToken | undefined | null
  /** Grant details - continue access token & uri for canceling the grant */
  grant?: GrantDetails | undefined | null
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
  'privateKey' | 'keyId' | 'exceptionList' | 'token' | 'grant'
> & {
  url: string | undefined
}

export type DeepNonNullable<T> = {
  [P in keyof T]?: NonNullable<T[P]>
}
