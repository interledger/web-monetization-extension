import { EventEmitter } from 'events'
import type { MonetizationTagDetails } from '../types'
import type { WalletAddress } from '@interledger/open-payments/dist/types'
import { checkWalletAddressUrlFormat, mozClone } from '../utils'
import type {
  // EmitToggleWMPayload,
  MonetizationEventPayload,
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload
} from '@/shared/messages'
import { ContentToContentAction } from '../messages'
import type { Cradle } from '@/content/container'

// observeLinks() {
// find all links in the page
// observe changes to links - add/remove/attr-changes
// validate link tags
// }

// observe page visibility

// on change: start/stop/pause/resume monetization

// handle events from background - monetization/load/error events

export class MonetizationLinkManager extends EventEmitter {
  private window: Cradle['window']
  private document: Cradle['document']
  private logger: Cradle['logger']
  private message: Cradle['message']

  private isTopFrame: boolean
  private isFirstLevelFrame: boolean
  private documentObserver: MutationObserver
  private monetizationLinkAttrObserver: MutationObserver
  private id: string
  // only entries corresponding to valid wallet addresses are here
  private monetizationLinks = new Map<HTMLLinkElement, MonetizationTagDetails>()

  constructor({ window, document, logger, message }: Cradle) {
    super()
    Object.assign(this, {
      window,
      document,
      logger,
      message
    })

    this.documentObserver = new MutationObserver((records) =>
      this.onWholeDocumentObserved(records)
    )

    this.monetizationLinkAttrObserver = new MutationObserver((records) =>
      this.onLinkAttrChange(records)
    )

    this.isTopFrame = window === window.top
    this.isFirstLevelFrame = window.parent === window.top
    this.id = crypto.randomUUID()

    if (!this.isTopFrame && this.isFirstLevelFrame) {
      // this.bindMessageHandler()
    }
  }

  start(): void {
    if (isDocumentReady(this.document)) {
      void this.run()
      return
    }

    document.addEventListener(
      'readystatechange',
      () => {
        if (isDocumentReady(this.document)) {
          void this.run()
        } else {
          document.addEventListener(
            'visibilitychange',
            () => {
              if (isDocumentReady(this.document)) {
                void this.run()
              }
            },
            { once: true }
          )
        }
      },
      { once: true }
    )
  }

  end() {}

  /**
   * Check if iframe or not
   */
  private async run() {
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        void this.resumeMonetization()
      } else {
        void this.stopMonetization()
      }
    })

    this.document
      .querySelectorAll<HTMLElement>('[onmonetization]')
      .forEach((node) => {
        this.dispatchOnMonetizationAttrChangedEvent(node)
      })

    this.documentObserver.observe(this.document, {
      subtree: true,
      childList: true,
      attributeFilter: ['onmonetization']
    })

    const monetizationLinks = getMonetizationLinkTags(
      this.document,
      this.isTopFrame
    )

    for (const link of monetizationLinks) {
      this.observeLinkAttrs(link)
    }

    const validLinks = (
      await Promise.all(monetizationLinks.map((elem) => this.checkLink(elem)))
    ).filter(isNotNull)

    for (const { link, details } of validLinks) {
      this.monetizationLinks.set(link, details)
    }

    await this.sendStartMonetization(validLinks.map((e) => e.details))
  }

  /** @throws never throws */
  private async checkLink(link: HTMLLinkElement) {
    if (!(link instanceof HTMLLinkElement && link.rel === 'monetization')) {
      return null
    }
    if (link.hasAttribute('disabled')) {
      return null
    }

    const walletAddress = await this.validateLink(link)
    if (!walletAddress) {
      return null
    }

    return {
      link,
      details: {
        requestId: crypto.randomUUID(),
        walletAddress: walletAddress
      }
    }
  }

  /** @throws never throws */
  private async validateLink(
    link: HTMLLinkElement
  ): Promise<WalletAddress | null> {
    const walletAddressUrl = link.href.trim()
    try {
      checkWalletAddressUrlFormat(walletAddressUrl)
      const response = await this.message.send('CHECK_WALLET_ADDRESS_URL', {
        walletAddressUrl
      })

      if (response.success === false) {
        throw new Error(
          `Could not retrieve wallet address information for ${JSON.stringify(walletAddressUrl)}.`
        )
      }

      this.dispatchLoadEvent(link)
      return response.payload
    } catch (e) {
      this.logger.error(e)
      this.dispatchErrorEvent(link)
      return null
    }
  }

  private observeLinkAttrs(link: HTMLLinkElement) {
    this.monetizationLinkAttrObserver.observe(link, {
      childList: false,
      attributeOldValue: true,
      attributeFilter: ['href', 'disabled', 'rel', 'crossorigin', 'type']
    })
  }

  private dispatchLoadEvent(tag: HTMLLinkElement) {
    tag.dispatchEvent(new Event('load'))
  }

  private dispatchErrorEvent(tag: HTMLLinkElement) {
    tag.dispatchEvent(new Event('error'))
  }

  dispatchMonetizationEvent({ requestId, details }: MonetizationEventPayload) {
    for (const [tag, tagDetails] of this.monetizationLinks) {
      if (tagDetails.requestId !== requestId) continue

      tag.dispatchEvent(
        new CustomEvent('__wm_ext_monetization', {
          detail: mozClone(details, this.document),
          bubbles: true
        })
      )
      break
    }
  }

  private dispatchOnMonetizationAttrChangedEvent(
    node: HTMLElement,
    { changeDetected = false } = {}
  ) {
    const attribute = node.getAttribute('onmonetization')
    if (!attribute && !changeDetected) return

    const customEvent = new CustomEvent('__wm_ext_onmonetization_attr_change', {
      bubbles: true,
      detail: mozClone({ attribute }, this.document)
    })
    node.dispatchEvent(customEvent)
  }

  private async stopMonetization() {
    const payload: StopMonetizationPayload[] = [
      ...this.monetizationLinks.values()
    ].map(({ requestId }) => ({ requestId }))

    await this.sendStopMonetization(payload)
  }

  private async resumeMonetization() {
    const payload: ResumeMonetizationPayload[] = [
      ...this.monetizationLinks.values()
    ].map(({ requestId }) => ({ requestId }))

    await this.sendResumeMonetization(payload)
  }

  private async sendStartMonetization(payload: StartMonetizationPayload[]) {
    if (!payload.length) return

    if (this.isTopFrame) {
      await this.message.send('START_MONETIZATION', payload)
    } else if (this.isFirstLevelFrame) {
      this.window.parent.postMessage(
        {
          message: ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_START,
          id: this.id,
          payload: payload
        },
        '*'
      )
    }
  }

  private async sendStopMonetization(payload: StopMonetizationPayload[]) {
    if (!payload.length) return
    await this.message.send('STOP_MONETIZATION', payload)
  }

  private async sendResumeMonetization(payload: ResumeMonetizationPayload[]) {
    if (this.isTopFrame) {
      if (payload.length) {
        await this.message.send('RESUME_MONETIZATION', payload)
      }
    } else if (this.isFirstLevelFrame) {
      this.window.parent.postMessage(
        {
          message: ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_RESUME,
          id: this.id,
          payload: payload
        },
        '*'
      )
    }
  }

  private async onWholeDocumentObserved(records: MutationRecord[]) {
    const stopMonetizationPayload: StopMonetizationPayload[] = []

    for (const record of records) {
      if (record.type === 'childList') {
        record.removedNodes.forEach(async (node) => {
          if (!(node instanceof HTMLLinkElement)) return
          const payloadEntry = this.onRemovedLink(node)
          stopMonetizationPayload.push(payloadEntry)
        })
      }
    }

    await this.sendStopMonetization(stopMonetizationPayload)

    if (this.isTopFrame) {
      const addedNodes = records
        .filter((e) => e.type === 'childList')
        .flatMap((e) => [...e.addedNodes])
      const allAddedLinkTags = await Promise.all(
        addedNodes.map((node) => this.onAddedNode(node))
      )
      const startMonetizationPayload = allAddedLinkTags
        .filter(isNotNull)
        .map(({ details }) => details)

      void this.sendStartMonetization(startMonetizationPayload)
    }

    for (const record of records) {
      if (
        record.type === 'attributes' &&
        record.target instanceof HTMLElement &&
        record.attributeName === 'onmonetization'
      ) {
        this.dispatchOnMonetizationAttrChangedEvent(record.target, {
          changeDetected: true
        })
      }
    }
  }

  private async onLinkAttrChange(records: MutationRecord[]) {
    const handledTags = new Set<Node>()
    const startMonetizationPayload: StartMonetizationPayload[] = []
    const stopMonetizationPayload: StopMonetizationPayload[] = []

    // Check for a non specified link with the type now specified and
    // just treat it as a newly seen, monetization tag
    for (const record of records) {
      const target = record.target as HTMLLinkElement
      if (handledTags.has(target)) {
        continue
      }

      const hasTarget = this.monetizationLinks.has(target)
      const linkRelSpecified =
        target instanceof HTMLLinkElement && target.rel === 'monetization'
      // this will also handle the case of a @disabled tag that
      // is not tracked, becoming enabled
      if (!hasTarget && linkRelSpecified) {
        const payloadEntry = await this.checkLink(target)
        if (payloadEntry) {
          this.monetizationLinks.set(target, payloadEntry.details)
          startMonetizationPayload.push(payloadEntry.details)
        }
        handledTags.add(target)
      } else if (hasTarget && !linkRelSpecified) {
        const payloadEntry = this.onRemovedLink(target)
        stopMonetizationPayload.push(payloadEntry)
        handledTags.add(target)
      } else if (!hasTarget && !linkRelSpecified) {
        // ignore these changes
        handledTags.add(target)
      } else if (hasTarget && linkRelSpecified) {
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
              const details = this.monetizationLinks.get(target)
              if (!details) {
                throw new Error('Could not find details for monetization node')
              }
              if (isDisabled) {
                stopMonetizationPayload.push({
                  requestId: details.requestId,
                  intent: 'disable'
                })
              } else {
                startMonetizationPayload.push(details)
              }
            } catch {
              const payloadEntry = await this.checkLink(target)
              if (payloadEntry) {
                this.monetizationLinks.set(target, payloadEntry.details)
                startMonetizationPayload.push(payloadEntry.details)
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
          stopMonetizationPayload.push(this.onRemovedLink(target))
          const payloadEntry = await this.checkLink(target)
          if (payloadEntry) {
            startMonetizationPayload.push(payloadEntry.details)
          }
          handledTags.add(target)
        }
      }
    }

    await this.sendStopMonetization(stopMonetizationPayload)
    void this.sendStartMonetization(startMonetizationPayload)
  }

  private async onAddedNode(node: Node) {
    if (node instanceof HTMLElement) {
      this.dispatchOnMonetizationAttrChangedEvent(node)
    }

    if (node instanceof HTMLLinkElement) {
      return await this.onAddedLink(node)
    }
    return null
  }

  private async onAddedLink(link: HTMLLinkElement) {
    this.observeLinkAttrs(link)
    const res = await this.checkLink(link)
    if (res) {
      this.monetizationLinks.set(link, res.details)
    }
    return res
  }

  private onRemovedLink(link: HTMLLinkElement): StopMonetizationPayload {
    const details = this.monetizationLinks.get(link)
    if (!details) {
      throw new Error(
        'Could not find details for monetization node ' +
          // node is removed, so the reference can not be displayed
          link.outerHTML.slice(0, 200)
      )
    }

    this.monetizationLinks.delete(link)

    return { requestId: details.requestId, intent: 'remove' }
  }
}

function isDocumentReady(doc: Document) {
  return (
    (doc.readyState === 'interactive' || doc.readyState === 'complete') &&
    doc.visibilityState === 'visible'
  )
}

function getMonetizationLinkTags(
  document: Document,
  isTopFrame: boolean
): HTMLLinkElement[] {
  if (isTopFrame) {
    return Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="monetization"]')
    )
  } else {
    const monetizationTag = document.querySelector<HTMLLinkElement>(
      'head link[rel="monetization"]'
    )
    return monetizationTag ? [monetizationTag] : []
  }
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}
