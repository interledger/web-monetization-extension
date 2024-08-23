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
  private monetizationTagAttrObserver: MutationObserver
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
    // this.monetizationTagAttrObserver = new MutationObserver((records) =>
    //   this.onMonetizationTagAttrsChange(records)
    // )

    this.isTopFrame = window === window.top
    this.isFirstLevelFrame = window.parent === window.top
    this.id = crypto.randomUUID()

    if (!this.isTopFrame && this.isFirstLevelFrame) {
      // this.bindMessageHandler()
    }
  }

  start(): void {
    if (isDocumentReady(this.document)) {
      this.run()
      return
    }

    document.addEventListener(
      'readystatechange',
      () => {
        if (isDocumentReady(this.document)) {
          this.run()
        } else {
          document.addEventListener(
            'visibilitychange',
            () => {
              if (isDocumentReady(this.document)) {
                this.run()
              }
            },
            { once: true }
          )
        }
      },
      { once: true }
    )
  }

  /**
   * Check if iframe or not
   */
  private async run() {
    this.document.addEventListener('visibilitychange', async () => {
      if (this.document.visibilityState === 'visible') {
        this.resumeMonetization()
      } else {
        this.stopMonetization()
      }
    })

    this.document.querySelectorAll('[onmonetization]').forEach((node) => {
      this.fireOnMonetizationAttrChangedEvent(node)
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

    for (const elem of monetizationLinks) {
      this.observeMonetizationLinkAttrs(elem)
    }

    const validMonetizationLinks = (
      await Promise.all(monetizationLinks.map((elem) => this.checkLink(elem)))
    ).filter(isNotNull)

    for (const { link, details } of validMonetizationLinks) {
      this.monetizationLinks.set(link, details)
    }

    this.sendStartMonetization(validMonetizationLinks.map((e) => e.details))
  }

  end() {}

  /** @throws never throws */
  private async checkLink(link: HTMLLinkElement) {
    if (!(link instanceof HTMLLinkElement && link.rel === 'monetization')) {
      return null
    }
    if (link.hasAttribute('disabled')) {
      return null
    }

    const walletAddress = await this.validateWalletAddress(link)
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
  private async validateWalletAddress(
    tag: HTMLLinkElement
  ): Promise<WalletAddress | null> {
    const walletAddressUrl = tag.href.trim()
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

      this.dispatchLoadEvent(tag)
      return response.payload
    } catch (e) {
      this.logger.error(e)
      this.dispatchErrorEvent(tag)
      return null
    }
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

  private observeMonetizationLinkAttrs(link: HTMLLinkElement) {
    this.logger.debug(link)
  }

  private fireOnMonetizationAttrChangedEvent(node: Element) {
    this.logger.debug(node)
  }

  private sendStartMonetization(payload: StartMonetizationPayload[]) {
    if (!payload.length) return

    if (this.isTopFrame) {
      void this.message.send('START_MONETIZATION', payload)
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

  private stopMonetization(intent?: StopMonetizationPayload['intent']) {
    const payload: StopMonetizationPayload[] = [
      ...this.monetizationLinks.values()
    ].map(({ requestId }) => ({ requestId, intent }))

    if (!payload.length) return
    void this.message.send('STOP_MONETIZATION', payload)
  }

  private resumeMonetization() {
    const payload: ResumeMonetizationPayload[] = [
      ...this.monetizationLinks.values()
    ].map(({ requestId }) => ({ requestId }))

    if (this.isTopFrame) {
      if (payload.length) {
        void this.message.send('RESUME_MONETIZATION', payload)
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
    if (stopMonetizationPayload.length) {
      await this.message.send('STOP_MONETIZATION', stopMonetizationPayload)
    }

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

      this.sendStartMonetization(startMonetizationPayload)
    }

    // this.onOnMonetizationChangeObserved(records)
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

  private async onAddedNode(node: Node) {
    if (node instanceof HTMLElement) {
      this.fireOnMonetizationAttrChangedEvent(node)
    }

    if (node instanceof HTMLLinkElement) {
      return await this.onAddedLink(node)
    }
    return null
  }

  private async onAddedLink(link: HTMLLinkElement) {
    // this.observeMonetizationTagAttrs(link)
    return await this.checkLink(link)
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
