import { WalletAddress } from '@interledger/open-payments/dist/types'

export type MonetizationTag = HTMLLinkElement & { href?: string }
export type MonetizationTagList = NodeListOf<MonetizationTag>

export type MonetizationTagDetails = {
  walletAddress: WalletAddress | null
  started: boolean
  paused: boolean
  stopped: boolean
  //   attrs: getTagAttrs(tag, tagType), ?????? what for
  //   initiatingUrl: this.window.location.href,  ?????? what for
  //   fromBody: tag.parentElement != this.document.head ?????? what for
}
