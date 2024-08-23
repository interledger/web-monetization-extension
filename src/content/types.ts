import { WalletAddress } from '@interledger/open-payments/dist/types'

export type MonetizationTag = HTMLLinkElement & { href?: string }
export type MonetizationTagList = NodeListOf<MonetizationTag>

export type MonetizationTagDetails = {
  walletAddress: WalletAddress
  requestId: string
}
