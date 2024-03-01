import { WalletAddress } from '@interledger/open-payments/dist/types'

export interface Amount {
  value: number
  interval?: string // https://en.wikipedia.org/wiki/ISO_8601#Repeating_intervals
}

interface AccessToken {
  value: string
  manage: string
}

export interface Storage {
  /** If web monetization is enabled */
  enabled: boolean
  /** If a wallet is connected or not */
  connected: boolean
  /** User wallet address information */
  walletAddress?: WalletAddress
  /** Overall amount */
  amount?: Amount
  /** Access token for quoting & outgoing payments  */
  token?: AccessToken
  /** Exception list with websites and each specific amount */
  exceptionList: {
    [website: string]: Amount
  }
  /** Key information */
  publicKey: string
  privateKey: string
  keyId: string
}
