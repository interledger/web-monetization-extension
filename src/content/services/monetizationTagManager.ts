import { EventEmitter } from 'events'

import { mozClone } from '../utils'
import { Logger } from '@/shared/logger'
import { MonetizationTagDetails } from '../types'
import { WalletAddress } from '@interledger/open-payments/dist/types'
import { checkWalletAddressUrlFormat } from '../utils'
import {
  checkWalletAddressUrlCall,
  isWMEnabled,
  resumeMonetization,
  startMonetization,
  stopMonetization
} from '../lib/messages'
import {
  EmitToggleWMPayload,
  MonetizationEventPayload,
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload
} from '@/shared/messages'
import { ContentToContentAction } from '../messages'

export type MonetizationTag = HTMLLinkElement

interface FireOnMonetizationChangeIfHaveAttributeParams {
  node: HTMLElement
  changeDetected?: boolean
}

export class MonetizationTagManager extends EventEmitter {
  private isTopFrame: boolean
  private isFirstLevelFrame: boolean
  private documentObserver: MutationObserver
  private monetizationTagAttrObserver: MutationObserver
  private id: string

  private monetizationTags = new Map<MonetizationTag, MonetizationTagDetails>()

  constructor(
    private window: Window,
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
        : this.stopAllMonetization()
    })

    this.isTopFrame = window === window.top
    this.isFirstLevelFrame = window.parent === window.top
    this.id = crypto.randomUUID()

    if (!this.isTopFrame && this.isFirstLevelFrame) {
      this.bindMessageHandler()
    }
  }

  private dispatchLoadEvent(tag: MonetizationTag) {
    tag.dispatchEvent(new Event('load'))
  }

  private dispatchErrorEvent(tag: MonetizationTag) {
    tag.dispatchEvent(new Event('error'))
  }

  dispatchMonetizationEvent({ requestId, details }: MonetizationEventPayload) {
    this.monetizationTags.forEach((tagDetails, tag) => {
      if (tagDetails.requestId !== requestId) return

      tag.dispatchEvent(
        new CustomEvent('__wm_ext_monetization', {
          detail: mozClone(details, this.document),
          bubbles: true
        })
      )
    })
    return
  }

  private async resumeAllMonetization() {
    const response = await isWMEnabled()

    if (response.success && response.payload) {
      const resumeMonetizationTags: ResumeMonetizationPayload[] = []

      this.monetizationTags.forEach((value) => {
        if (value.requestId && value.walletAddress) {
          resumeMonetizationTags.push({ requestId: value.requestId })
        }
      })

      this.sendResumeMonetization(resumeMonetizationTags)
    }
  }

  private stopAllMonetization(intent?: StopMonetizationPayload['intent']) {
    const stopMonetizationTags: StopMonetizationPayload[] = []
    this.monetizationTags.forEach((value) => {
      if (value.requestId && value.walletAddress) {
        stopMonetizationTags.push({ requestId: value.requestId, intent })
      }
    })

    this.sendStopMonetization(stopMonetizationTags)
  }

  private async onWholeDocumentObserved(records: MutationRecord[]) {
    const startMonetizationTagsPromises: Promise<StartMonetizationPayload | null>[] =
      []
    const stopMonetizationTags: StopMonetizationPayload[] = []

    for (const record of records) {
      if (record.type === 'childList') {
        record.removedNodes.forEach(async (node) => {
          const stopMonetizationTag = this.checkRemoved(node)
          if (stopMonetizationTag)
            stopMonetizationTags.push(stopMonetizationTag)
        })
      }
    }

    await this.sendStopMonetization(stopMonetizationTags)

    if (this.isTopFrame) {
      for (const record of records) {
        if (record.type === 'childList') {
          record.addedNodes.forEach(async (node) => {
            const startMonetizationTag = this.checkAdded(node)
            startMonetizationTagsPromises.push(startMonetizationTag)
          })
        }
      }

      Promise.allSettled(startMonetizationTagsPromises).then((result) => {
        const startMonetizationTags: StartMonetizationPayload[] = []
        result.forEach((res) => {
          if (res.status === 'fulfilled' && res.value) {
            startMonetizationTags.push(res.value)
          }
        })

        this.sendStartMonetization(startMonetizationTags)
      })
    }

    this.onOnMonetizationChangeObserved(records)
  }

  async onMonetizationTagAttrsChange(records: MutationRecord[]) {
    const handledTags = new Set<Node>()
    const startMonetizationTags: StartMonetizationPayload[] = []
    const stopMonetizationTags: StopMonetizationPayload[] = []

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
        const startMonetizationTag = await this.onAddedTag(target)
        if (startMonetizationTag)
          startMonetizationTags.push(startMonetizationTag)

        handledTags.add(target)
      } else if (hasTarget && !typeSpecified) {
        stopMonetizationTags.push(this.onRemovedTag(target))
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
            try {
              const { requestId, walletAddress } = this.getTagDetails(
                target,
                'onChangeDisabled'
              )
              if (isDisabled) {
                stopMonetizationTags.push({ requestId, intent: 'disable' })
              } else if (walletAddress) {
                startMonetizationTags.push({ requestId, walletAddress })
              }
            } catch (error) {
              const startMonetizationPayload = await this.onAddedTag(target)
              if (startMonetizationPayload) {
                startMonetizationTags.push(startMonetizationPayload)
              }
            }

            handledTags.add(target)
          }
        } else if (
          record.type === 'attributes' &&
          record.attributeName === 'href' &&
          target instanceof HTMLLinkElement &&
          target.href !== record.oldValue
        ) {
          const { startMonetizationTag, stopMonetizationTag } =
            await this.onChangedWalletAddressUrl(target)
          if (startMonetizationTag)
            startMonetizationTags.push(startMonetizationTag)
          if (stopMonetizationTag)
            stopMonetizationTags.push(stopMonetizationTag)

          handledTags.add(target)
        }
      }
    }

    await this.sendStopMonetization(stopMonetizationTags)
    this.sendStartMonetization(startMonetizationTags)
  }

  private async checkAdded(node: Node) {
    if (node instanceof HTMLElement) {
      this.fireOnMonetizationAttrChangedEvent({ node })
    }

    if (node instanceof HTMLLinkElement) {
      this.observeMonetizationTagAttrs(node)
      return await this.onAddedTag(node)
    }

    return null
  }

  private checkRemoved(node: Node) {
    return node instanceof HTMLLinkElement && this.monetizationTags.has(node)
      ? this.onRemovedTag(node)
      : null
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
  async onChangedWalletAddressUrl(
    tag: MonetizationTag,
    wasDisabled = false,
    isDisabled = false
  ) {
    const { requestId } = this.getTagDetails(tag, 'onChangedWalletAddressUrl')
    let stopMonetizationTag = null

    if (!wasDisabled && !isDisabled) {
      stopMonetizationTag = this.onRemovedTag(tag)
    }

    const startMonetizationTag = await this.onAddedTag(tag, requestId)

    return { startMonetizationTag, stopMonetizationTag }
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

    const customEvent = new CustomEvent('__wm_ext_onmonetization_attr_change', {
      bubbles: true,
      detail: mozClone({ attribute }, this.document)
    })

    node.dispatchEvent(customEvent)
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
    if (!this.isTopFrame && this.isFirstLevelFrame) {
      this.window.parent.postMessage(
        {
          message: ContentToContentAction.INITIALIZE_IFRAME,
          id: this.id
        },
        '*'
      )
    }

    let monetizationTags: NodeListOf<MonetizationTag> | MonetizationTag[]

    if (this.isTopFrame) {
      monetizationTags = this.document.querySelectorAll(
        'link[rel="monetization"]'
      )
    } else {
      const monetizationTag: MonetizationTag | null =
        this.document.querySelector('head link[rel="monetization"]')
      monetizationTags = monetizationTag ? [monetizationTag] : []
    }

    const startMonetizationTagsPromises: Promise<StartMonetizationPayload | null>[] =
      []

    monetizationTags.forEach(async (tag) => {
      try {
        this.observeMonetizationTagAttrs(tag)
        const startMonetizationTag = this.onAddedTag(tag)
        startMonetizationTagsPromises.push(startMonetizationTag)
      } catch (e) {
        this.logger.error(e)
      }
    })

    Promise.allSettled(startMonetizationTagsPromises).then((result) => {
      const startMonetizationTags: StartMonetizationPayload[] = []
      result.forEach((res) => {
        if (res.status === 'fulfilled' && res.value) {
          startMonetizationTags.push(res.value)
        }
      })

      this.sendStartMonetization(startMonetizationTags)
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

  stop() {
    this.documentObserver.disconnect()
    this.monetizationTagAttrObserver.disconnect()
    this.monetizationTags.clear()
  }

  // Remove tag from list & stop monetization
  private onRemovedTag(tag: MonetizationTag): StopMonetizationPayload {
    const { requestId } = this.getTagDetails(tag, 'onRemovedTag')
    this.monetizationTags.delete(tag)

    return { requestId, intent: 'remove' }
  }

  // Add tag to list & start monetization
  private async onAddedTag(
    tag: MonetizationTag,
    crtRequestId?: string
  ): Promise<StartMonetizationPayload | null> {
    const walletAddress = await this.checkTag(tag)
    if (!walletAddress) return null

    const requestId = crtRequestId ?? crypto.randomUUID()
    const details: MonetizationTagDetails = {
      walletAddress,
      requestId
    }

    this.monetizationTags.set(tag, details)
    return { walletAddress, requestId }
  }

  private sendStartMonetization(tags: StartMonetizationPayload[]) {
    if (!tags.length) return
    const isFrameMonetizedMessage = {
      message: ContentToContentAction.IS_FRAME_MONETIZED,
      id: this.id,
      payload: { isMonetized: tags.length > 0 }
    }

    if (this.isTopFrame) {
      startMonetization(tags)

      // Update icon
      this.window.postMessage(isFrameMonetizedMessage, '*')
    } else if (this.isFirstLevelFrame) {
      this.window.parent.postMessage(
        {
          message: ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_START,
          id: this.id,
          payload: tags
        },
        '*'
      )
      // Update icon
      this.window.parent.postMessage(isFrameMonetizedMessage, '*')
    }
  }

  private async sendStopMonetization(tags: StopMonetizationPayload[]) {
    if (!tags.length) return
    await stopMonetization(tags)

    // Check if tab still monetized
    const validTagsCount = [...this.monetizationTags].reduce(
      (count, [tag, { requestId, walletAddress }]) => {
        return !tag.disabled && requestId && walletAddress ? count + 1 : count
      },
      0
    )

    const isFrameMonetizedMessage = {
      message: ContentToContentAction.IS_FRAME_MONETIZED,
      id: this.id,
      payload: { isMonetized: validTagsCount > 0 }
    }

    if (this.isTopFrame) {
      this.window.postMessage(isFrameMonetizedMessage, '*')
    } else if (this.isFirstLevelFrame) {
      this.window.parent.postMessage(isFrameMonetizedMessage, '*')
    }
  }

  private sendResumeMonetization(tags: ResumeMonetizationPayload[]) {
    const isFrameMonetizedMessage = {
      message: ContentToContentAction.IS_FRAME_MONETIZED,
      id: this.id,
      payload: { isMonetized: tags.length > 0 }
    }

    if (this.isTopFrame) {
      resumeMonetization(tags)

      // Update icon
      this.window.postMessage(isFrameMonetizedMessage, '*')
    } else if (this.isFirstLevelFrame) {
      this.window.parent.postMessage(
        {
          message: ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_RESUME,
          id: this.id,
          payload: tags
        },
        '*'
      )

      // Update icon
      this.window.parent.postMessage(isFrameMonetizedMessage, '*')
    }
  }

  // Check tag to be enabled and for valid wallet address
  private async checkTag(tag: MonetizationTag): Promise<WalletAddress | null> {
    if (!(tag instanceof HTMLLinkElement && tag.rel === 'monetization'))
      return null

    if (tag.hasAttribute('disabled')) return null

    const walletAddressInfo = await this.validateWalletAddress(tag)

    return walletAddressInfo
  }

  private async validateWalletAddress(
    tag: MonetizationTag
  ): Promise<WalletAddress | null> {
    const walletAddressUrl = tag.href.trim()
    try {
      checkWalletAddressUrlFormat(walletAddressUrl)
      const response = await checkWalletAddressUrlCall({ walletAddressUrl })

      if (response.success === false) {
        throw new Error(
          `Could not retrieve wallet address information for ${JSON.stringify(walletAddressUrl)}.`
        )
      }

      this.dispatchLoadEvent(tag)
      return response.payload
    } catch (e) {
      this.logger.error(e)
      this.dispatchErrorEvent(tag)
      return null
    }
  }

  private bindMessageHandler() {
    this.window.addEventListener('message', (event) => {
      const { message, id, payload } = event.data

      if (event.origin === window.location.href || id !== this.id) return

      switch (message) {
        case ContentToContentAction.START_MONETIZATION:
          startMonetization(payload)
          return
        case ContentToContentAction.RESUME_MONETIZATION:
          resumeMonetization(payload)
          return
        default:
          return
      }
    })
  }

  async toggleWM({ enabled }: EmitToggleWMPayload) {
    if (enabled) {
      await this.resumeAllMonetization()
    } else {
      // TODO: https://github.com/interledger/web-monetization-extension/issues/452
      this.stopAllMonetization()
    }
  }
}
