import { EventEmitter } from 'events'

import { mozClone } from '../utils'
import { Logger } from '@/shared/logger'
import { MonetizationTagDetails } from '../types'
import { WalletAddress } from '@interledger/open-payments/dist/types'
import { checkWalletAddressUrlFormat } from '../utils'
import {
  checkWalletAddressUrlCall,
  startMonetization,
  stopMonetization
} from '../lib/messages'

export type MonetizationTag = HTMLLinkElement

interface FireOnMonetizationChangeIfHaveAttributeParams {
  node: HTMLElement
  changeDetected?: boolean
}

export class MonetizationTagManager extends EventEmitter {
  private documentObserver: MutationObserver
  private monetizationTagAttrObserver: MutationObserver

  private monetizationTags = new Map<MonetizationTag, MonetizationTagDetails>()

  private monetizationTagsIds = new Map<string, MonetizationTag>()

  constructor(
    private document: Document,
    private logger: Logger
  ) {
    super()
    this.documentObserver = new MutationObserver((records) =>
      this.onWholeDocumentObserved(records)
    )
    this.monetizationTagAttrObserver = new MutationObserver((records) =>
      this.onMonetizationTagAttrsChange(records)
    )
  }

  private onWholeDocumentObserved(records: MutationRecord[]) {
    this.logger.info('document mutation records.length=', records.length)

    for (const record of records) {
      this.logger.info('Record', record.type, record.target)
      if (record.type === 'childList') {
        record.removedNodes.forEach((node) => this.check('removed', node))
      }
    }

    for (const record of records) {
      this.logger.info('Record', record.type, record.target)
      if (record.type === 'childList') {
        record.addedNodes.forEach((node) => this.check('added', node))
      }
    }

    this.onOnMonetizationChangeObserved(records)
  }

  // TO DO
  async onMonetizationTagAttrsChange(records: MutationRecord[]) {
    const handledTags = new Set<Node>()

    // Check for a non specified link with the type now specified and
    // just treat it as a newly seen, monetization tag
    for (const record of records) {
      const target = record.target as MonetizationTag
      if (handledTags.has(target)) {
        continue
      }
      const hasTarget = this.monetizationTags.has(target)
      const typeSpecified =
        target instanceof HTMLLinkElement && target.rel === 'monetization'
      // this will also handle the case of a @disabled tag that
      // is not tracked, becoming enabled
      if (!hasTarget && typeSpecified) {
        await this.onAddedTag(target)
        handledTags.add(target)
      } else if (hasTarget && !typeSpecified) {
        this.onRemovedTag(target)
        handledTags.add(target)
      } else if (!hasTarget && !typeSpecified) {
        // ignore these changes
        handledTags.add(target)
      } else if (hasTarget && typeSpecified) {
        if (
          record.type === 'attributes' &&
          record.attributeName === 'disabled' &&
          target instanceof HTMLLinkElement &&
          // can't use record.target[disabled] as it's a Boolean not string
          target.getAttribute('disabled') !== record.oldValue
        ) {
          const wasDisabled = record.oldValue !== null
          const isDisabled = target.hasAttribute('disabled')
          if (wasDisabled != isDisabled) {
            this._onChangedWalletAddressUrl(target, wasDisabled)
            handledTags.add(target)
          }
        } else if (
          record.type === 'attributes' &&
          record.attributeName === 'href' &&
          target instanceof HTMLLinkElement &&
          target.href !== record.oldValue
        ) {
          this._onChangedWalletAddressUrl(target)
          handledTags.add(target)
        }
      }
    }
  }

  // TO DO
  async check(op: string, node: Node) {
    this.logger.info('head node', op, node)

    if (node instanceof HTMLLinkElement) {
      if (op === 'added') {
        this.observeMonetizationTagAttrs(node)
        await this.onAddedTag(node)
      } else if (op === 'removed' && this.monetizationTags.has(node)) {
        this.onRemovedTag(node)
      }
    }
    if (op === 'added' && node instanceof HTMLElement) {
      this.fireOnMonetizationAttrChangedEvent({ node })
    }
  }

  private observeMonetizationTagAttrs(tag: MonetizationTag) {
    this.monetizationTagAttrObserver.observe(tag, {
      childList: false,
      attributeOldValue: true,
      attributeFilter: ['href', 'disabled', 'rel', 'crossorigin', 'type']
    })
  }

  private getTagDetails(tag: MonetizationTag, caller = '') {
    const tagDetails = this.monetizationTags.get(tag)

    if (!tagDetails) {
      throw new Error(
        `${caller}: tag not tracked: ${tag.outerHTML.slice(0, 200)}`
      )
    }

    return tagDetails
  }

  // If wallet address changed, remove old tag and add new one
  async _onChangedWalletAddressUrlTag(
    tag: MonetizationTag,
    wasDisabled = false
  ) {
    const { requestId } = this.getTagDetails(tag, '_onChangedWalletAddressUrl')

    if (!wasDisabled) {
      this.onRemovedTag(tag)
      stopMonetization({ requestId })
    }

    this.onAddedTag(tag, requestId)
  }

  private onOnMonetizationChangeObserved(records: MutationRecord[]) {
    for (const record of records) {
      if (
        record.type === 'attributes' &&
        record.target instanceof HTMLElement &&
        record.attributeName === 'onmonetization'
      ) {
        this.fireOnMonetizationAttrChangedEvent({
          node: record.target,
          changeDetected: true
        })
      }
    }
  }

  private fireOnMonetizationAttrChangedEvent({
    node,
    changeDetected = false
  }: FireOnMonetizationChangeIfHaveAttributeParams) {
    const attribute = node.getAttribute('onmonetization')

    if (!attribute && !changeDetected) return

    const customEvent = new CustomEvent('onmonetization-attr-changed', {
      bubbles: true,
      detail: mozClone({ attribute }, this.document)
    })

    const result = node.dispatchEvent(customEvent)

    this.logger.info('dispatched onmonetization-attr-changed ev', result)
  }

  init(): void {
    if (
      document.readyState === 'interactive' ||
      document.readyState === 'complete'
    )
      this.start()

    document.addEventListener(
      'readystatechange',
      () => {
        if (document.readyState === 'interactive') {
          this.start()
        }
      },
      { once: true }
    )
  }

  private start() {
    const monetizationTags: NodeListOf<MonetizationTag> =
      this.document.querySelectorAll('link')

    monetizationTags.forEach(async (tag) => {
      try {
        this.observeMonetizationTagAttrs(tag)
        await this.onAddedTag(tag)
      } catch (e) {
        this.logger.error(e)
      }
    })

    const onMonetizations: NodeListOf<HTMLElement> =
      this.document.querySelectorAll('[onmonetization]')

    onMonetizations.forEach((node) => {
      this.fireOnMonetizationAttrChangedEvent({ node })
    })

    this.documentObserver.observe(this.document, {
      subtree: true,
      childList: true,
      attributeFilter: ['onmonetization']
    })
  }

  // TO DO
  stop() {
    this.documentObserver.disconnect()
    this.monetizationTagAttrObserver.disconnect()
    this.monetizationTags.clear()
  }

  // TO DO
  // Remove tag from list & stop monetization
  private onRemovedTag(tag: MonetizationTag) {
    const { requestId } = this.getTagDetails(tag, 'onRemovedTag')
    this.monetizationTags.delete(tag)
    stopMonetization({ requestId })
  }

  // TO DO
  // Add tag to list & start monetization
  private async onAddedTag(tag: MonetizationTag, crtRequestId?: string) {
    const walletAddress = await this.checkTag(tag)
    const requestId = crtRequestId ?? crypto.randomUUID()

    const details: MonetizationTagDetails = {
      walletAddress,
      requestId
      // started: true,
      // paused: false,
      // stopped: false
    }

    this.monetizationTags.set(tag, details)
    this.monetizationTagsIds.set(requestId, tag)

    if (walletAddress) startMonetization({ requestId, walletAddress })
  }

  // Check tag to be enabled and for valid wallet address
  private async checkTag(tag: MonetizationTag): Promise<WalletAddress | null> {
    if (!(tag instanceof HTMLLinkElement && tag.rel === 'monetization'))
      return null

    if (tag.hasAttribute('disabled')) return null

    const isValidWalletAddressUrlFormat = this.checkWalletAddressUrlFormat(tag)

    return isValidWalletAddressUrlFormat
      ? await this.checkWalletAddressUrlCall(tag)
      : null
  }

  // Check wallet address url for valid format
  private checkWalletAddressUrlFormat(tag: MonetizationTag) {
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

  // Check wallet address url by fetching the wallet address details
  private async checkWalletAddressUrlCall(
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
