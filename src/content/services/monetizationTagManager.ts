import { Logger } from '@/shared/logger'
import {
  MonetizationTag,
  MonetizationTagList,
  MonetizationTagDetails
} from '../types'
import { checkWalletAddressUrlFormat } from '../utils'
import { WalletAddress } from '@interledger/open-payments/dist/types'
import { checkWalletAddressUrlCall, startMonetization } from '../lib/messages'

export class MonetizationTagManager {
  private monetizationTagsDetails: {
    [requestId: string]: MonetizationTagDetails
  }

  constructor(
    private document: Document,
    private logger: Logger
  ) {}

  start() {
    const monetizationTags: MonetizationTagList =
      this.document.querySelectorAll('link[rel="monetization"]')

    this.monetizationTagsDetails = {}

    monetizationTags.forEach(async (tag) => {
      try {
        const walletAddress = await this.checkTag(tag)
        const requestId = crypto.randomUUID()

        // TODO: save only valid ?
        const tagDetails = {
          walletAddress,
          started: !!walletAddress && true,
          paused: false,
          stopped: false
        }

        this.monetizationTagsDetails[requestId] = tagDetails
        if (walletAddress) startMonetization({ walletAddress, requestId })
      } catch (err) {
        this.logger.error('Verify tag')
      }
    })
  }

  async checkTag(tag: MonetizationTag): Promise<WalletAddress | null> {
    if (tag.hasAttribute('disabled')) return null

    const isValidWalletAddressUrlFormat = this.checkWalletAddressUrlFormat(tag)

    return isValidWalletAddressUrlFormat
      ? await this.checkWalletAddressUrlCall(tag)
      : null
  }

  checkWalletAddressUrlFormat(tag: MonetizationTag) {
    const walletAddressUrl = tag.href.trim()

    try {
      checkWalletAddressUrlFormat(walletAddressUrl, true)

      return true
    } catch (err) {
      this.logger.error(err)

      const event = new Event('error')
      tag.dispatchEvent(event)

      return false
    }
  }

  async checkWalletAddressUrlCall(
    tag: MonetizationTag
  ): Promise<WalletAddress | null> {
    const walletAddressUrl = tag.href.trim()

    try {
      const response = await checkWalletAddressUrlCall({ walletAddressUrl })

      return response.success ? response.payload : null
    } catch (err) {
      this.logger.error(err)

      const event = new Event('error')
      tag.dispatchEvent(event)

      return null
    }
  }
}
