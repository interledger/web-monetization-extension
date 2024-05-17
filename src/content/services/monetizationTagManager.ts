import { EventEmitter } from 'events'

import { mozClone } from '../utils'
import { Logger } from '@/shared/logger'
import { MonetizationTagDetails } from '../types'
import { WalletAddress } from '@interledger/open-payments/dist/types'
import { checkWalletAddressUrlFormat } from '../utils'
import {
  checkWalletAddressUrlCall,
  isTabMonetized,
  isWMEnabled,
  resumeMonetization,
  startMonetization,
  stopMonetization
} from '../lib/messages'
import {
  EmitToggleWMPayload,
  MonetizationEventPayload
} from '@/shared/messages'

export type MonetizationTag = HTMLLinkElement

interface FireOnMonetizationChangeIfHaveAttributeParams {
  node: HTMLElement
  changeDetected?: boolean
}

export class MonetizationTagManager extends EventEmitter {
  private documentObserver: MutationObserver
  private monetizationTagAttrObserver: MutationObserver
  private iconUpdated: boolean

  private monetizationTags = new Map<MonetizationTag, MonetizationTagDetails>()

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

    document.addEventListener('visibilitychange', async () => {
      document.visibilityState === 'visible'
        ? await this.resumeAllMonetization()
        : await this.stopAllMonetization()
    })
  }

  dispatchMonetizationEvent({ requestId, details }: MonetizationEventPayload) {
    this.monetizationTags.forEach((tagDetails, tag) => {
      if (tagDetails.requestId !== requestId) return

      const customEvent = new CustomEvent('monetization', {
        bubbles: true,
        detail: mozClone(details, this.document)
      })

      tag.dispatchEvent(customEvent)
    })
    return
  }

  private async resumeAllMonetization() {
    const response = await isWMEnabled()

    if (response.success && response.payload) {
      let validTagsCount = 0

      this.monetizationTags.forEach((value) => {
        if (value.requestId && value.walletAddress) {
          resumeMonetization({ requestId: value.requestId })
          ++validTagsCount
        }
      })

      isTabMonetized({ value: validTagsCount > 0 })
    }
  }

  private stopAllMonetization() {
    this.monetizationTags.forEach((value) => {
      if (value.requestId && value.walletAddress)
        stopMonetization({ requestId: value.requestId })
    })
  }

  private onWholeDocumentObserved(records: MutationRecord[]) {
    this.iconUpdated = false

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

  async onMonetizationTagAttrsChange(records: MutationRecord[]) {
    this.iconUpdated = false

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
          target.getAttribute('disabled') !== record.oldValue
        ) {
          const wasDisabled = record.oldValue !== null
          const isDisabled = target.hasAttribute('disabled')
          if (wasDisabled != isDisabled) {
            this.onChangedWalletAddressUrl(target, wasDisabled)
            handledTags.add(target)
          }
        } else if (
          record.type === 'attributes' &&
          record.attributeName === 'href' &&
          target instanceof HTMLLinkElement &&
          target.href !== record.oldValue
        ) {
          this.onChangedWalletAddressUrl(target)
          handledTags.add(target)
        }
      }
    }
  }

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
  async onChangedWalletAddressUrl(tag: MonetizationTag, wasDisabled = false) {
    const { requestId } = this.getTagDetails(tag, 'onChangedWalletAddressUrl')

    if (!wasDisabled) {
      this.onRemovedTag(tag)
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

  start(): void {
    if (
      document.readyState === 'interactive' ||
      document.readyState === 'complete'
    )
      this.run()

    document.addEventListener(
      'readystatechange',
      () => {
        if (document.readyState === 'interactive') {
          this.run()
        }
      },
      { once: true }
    )
  }

  private run() {
    this.iconUpdated = false

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

    this.checkIsTabMonetized()

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

  stop() {
    this.documentObserver.disconnect()
    this.monetizationTagAttrObserver.disconnect()
    this.monetizationTags.clear()
  }

  // Remove tag from list & stop monetization
  private onRemovedTag(tag: MonetizationTag) {
    const { requestId } = this.getTagDetails(tag, 'onRemovedTag')
    this.monetizationTags.delete(tag)
    stopMonetization({ requestId })

    // Check if tab still monetized
    this.checkIsTabMonetized()
  }

  private checkIsTabMonetized() {
    let validTagsCount = 0

    this.monetizationTags.forEach((value) => {
      if (value.requestId && value.walletAddress) ++validTagsCount
    })

    isTabMonetized({ value: validTagsCount > 0 })
  }

  // Add tag to list & start monetization
  private async onAddedTag(tag: MonetizationTag, crtRequestId?: string) {
    const walletAddress = await this.checkTag(tag)
    const requestId = crtRequestId ?? crypto.randomUUID()

    const details: MonetizationTagDetails = {
      walletAddress,
      requestId
    }

    this.monetizationTags.set(tag, details)

    if (walletAddress) {
      startMonetization({ requestId, walletAddress })

      if (!this.iconUpdated) {
        isTabMonetized({ value: true })
        this.iconUpdated = true
      }
    }
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

  async toggleWM({ enabled }: EmitToggleWMPayload) {
    if (enabled) {
      await this.resumeAllMonetization()
    } else {
      await this.stopAllMonetization()
    }
  }
}
