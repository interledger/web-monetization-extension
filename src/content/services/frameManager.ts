import { Logger } from '@/shared/logger'

export class FrameManager {
  isTopFrame: boolean
  isFirstLevelFrame: boolean
  private documentObserver: MutationObserver
  private frameAllowAttrObserver: MutationObserver
  frames = new Map<HTMLIFrameElement, string>()

  constructor(
    private window: Window,
    private document: Document,
    private logger: Logger
  ) {
    this.isTopFrame = window === window.top
    this.isFirstLevelFrame = window.parent === window.top

    this.documentObserver = new MutationObserver((records) =>
      this.onWholeDocumentObserved(records)
    )

    this.frameAllowAttrObserver = new MutationObserver((records) =>
      this.onFrameAllowAttrChange(records)
    )

    if (!this.isTopFrame) return

    window.addEventListener('message', (event: any) => {
      this.logger.log(
        'origin',
        event.origin,
        'crtLocation',
        window.location.href,
        'data',
        event.data
      )
      const { message } = event.data
      const frame = this.findIframe(event.source)

      if (!frame) return

      switch (message) {
        case 'init':
          this.frames.set(frame, event.data.id)
          return
        case 'isAllowed':
          if (frame.allow === 'monetization') {
            const { requestId, walletAddress, id } = event.data
            this.logger.info('source', event.origin, event)

            event.source.postMessage(
              {
                message: 'startMonetization',
                requestId,
                walletAddress,
                id
              },
              '*'
            )
          }
          return

        default:
          return
      }
    })
  }

  private findIframe(sourceWindow: Window): HTMLIFrameElement | null {
    const iframes = this.frames.keys()
    let frame

    do {
      frame = iframes.next()
      if (frame.done) return null
      if (frame.value.contentWindow === sourceWindow) return frame.value
    } while (!frame.done)

    return null
  }

  private observeDocumentForFrames() {
    this.documentObserver.observe(this.document, {
      subtree: true,
      childList: true
    })
  }

  private observeFrameAllowAttrs(frame: HTMLIFrameElement) {
    this.frameAllowAttrObserver.observe(frame, {
      childList: false,
      attributeOldValue: true,
      attributeFilter: ['allow']
    })
  }

  async onFrameAllowAttrChange(records: MutationRecord[]) {
    const handledTags = new Set<Node>()

    // Check for a non specified link with the type now specified and
    // just treat it as a newly seen, monetization tag
    for (const record of records) {
      const target = record.target as HTMLIFrameElement
      if (handledTags.has(target)) {
        continue
      }
      const hasTarget = this.frames.has(target)
      const typeSpecified =
        target instanceof HTMLIFrameElement && target.allow === 'monetization'

      if (!hasTarget && typeSpecified) {
        await this.onAddedFrame(target)
        handledTags.add(target)
      } else if (hasTarget && !typeSpecified) {
        this.onRemovedFrame(target)
        handledTags.add(target)
      } else if (!hasTarget && !typeSpecified) {
        // ignore these changes
        handledTags.add(target)
      }
    }
  }

  private async onAddedFrame(frame: HTMLIFrameElement) {
    this.frames.set(frame, '')
  }

  private async onRemovedFrame(frame: HTMLIFrameElement) {
    const frameId = this.frames.get(frame)
    frame.contentWindow?.postMessage({
      message: 'stopMonetization',
      id: frameId
    })
    this.frames.delete(frame)
  }

  private onWholeDocumentObserved(records: MutationRecord[]) {
    for (const record of records) {
      if (record.type === 'childList') {
        record.removedNodes.forEach((node) => this.check('removed', node))
      }
    }

    if (this.isTopFrame)
      for (const record of records) {
        if (record.type === 'childList') {
          record.addedNodes.forEach((node) => this.check('added', node))
        }
      }
  }

  async check(op: string, node: Node) {
    if (node instanceof HTMLIFrameElement) {
      if (op === 'added') {
        this.observeFrameAllowAttrs(node)
        await this.onAddedFrame(node)
      } else if (op === 'removed' && this.frames.has(node)) {
        this.onRemovedFrame(node)
      }
    }
  }

  start(): void {
    // Ignore all nested iframe
    if (!this.isTopFrame) return

    this.logger.info('start frame manager', this.window.location.href)

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
    const frames: NodeListOf<HTMLIFrameElement> =
      this.document.querySelectorAll('iframe')

    frames.forEach(async (frame) => {
      try {
        this.observeFrameAllowAttrs(frame)
        await this.onAddedFrame(frame)
      } catch (e) {
        this.logger.error(e)
      }
    })
    this.observeDocumentForFrames()
  }
}
