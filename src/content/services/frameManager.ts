import { Logger } from '@/shared/logger'
import { stopMonetization } from '../lib/messages'
import { ContentToContentAction } from '../messages'

export class FrameManager {
  private documentObserver: MutationObserver
  private frameAllowAttrObserver: MutationObserver
  private frames = new Map<
    HTMLIFrameElement,
    { frameId: string | null; requestIds: string[] }
  >()

  constructor(
    private window: Window,
    private document: Document,
    private logger: Logger
  ) {
    this.documentObserver = new MutationObserver((records) =>
      this.onWholeDocumentObserved(records)
    )

    this.frameAllowAttrObserver = new MutationObserver((records) =>
      this.onFrameAllowAttrChange(records)
    )
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
    this.frames.set(frame, { frameId: null, requestIds: [] })
  }

  private async onRemovedFrame(frame: HTMLIFrameElement) {
    this.logger.info('onRemovedFrame', frame)

    const frameDetails = this.frames.get(frame)

    frameDetails?.requestIds.forEach((requestId) =>
      stopMonetization({ requestId })
    )

    this.frames.delete(frame)
  }

  private onWholeDocumentObserved(records: MutationRecord[]) {
    for (const record of records) {
      if (record.type === 'childList') {
        record.removedNodes.forEach((node) => this.check('removed', node))
      }
    }

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
    this.bindMessageHandler()

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

  private bindMessageHandler() {
    this.window.addEventListener('message', (event: any) => {
      if (event.origin === this.window.location.href) return

      const { message, payload, id } = event.data
      const frame = this.findIframe(event.source)

      if (!frame) return

      const frameDetails = this.frames.get(frame)

      switch (message) {
        case ContentToContentAction.INITILIZE_IFRAME:
          this.frames.set(frame, { frameId: id, requestIds: [] })
          return

        case ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_START:
          if (frame.allow === 'monetization') {
            this.frames.set(frame, {
              frameId: id,
              requestIds: [payload.requestId]
            })

            event.source.postMessage(
              {
                message: ContentToContentAction.START_MONETIZATION,
                id,
                payload
              },
              '*'
            )
          }

          return

        case ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_RESUME:
          if (frame.allow === 'monetization') {
            this.frames.set(frame, {
              frameId: id,
              requestIds: [payload.requestId]
            })

            event.source.postMessage(
              {
                message: ContentToContentAction.RESUME_MONETIZATION,
                id,
                payload
              },
              '*'
            )
          }
          return

        case ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_STOP:
          if (frameDetails?.requestIds.length) {
            event.source.postMessage(
              {
                message: ContentToContentAction.STOP_MONETIZATION,
                id,
                payload
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
}
