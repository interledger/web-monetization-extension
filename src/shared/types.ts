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
  /** User wallet address information */
  walletAddress: WalletAddress | undefined
  /** Overall amount */
  amount?: WalletAmount | undefined
  /** Access token for quoting & outgoing payments  */
  token?: AccessToken | undefined
  /** Grant details - continue access token & uri for canceling the grant */
  grant?: GrantDetails | undefined
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

export type PopupState = Omit<
  Storage,
  'privateKey' | 'keyId' | 'exceptionList' | 'token' | 'grant'
> & {
  website: WebsiteData
}
