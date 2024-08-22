import { ContentToContentAction } from '../messages'
import {
  ContentToBackgroundAction,
  type ResumeMonetizationPayload,
  type StartMonetizationPayload,
  type StopMonetizationPayload
} from '@/shared/messages'
import type { Cradle } from '@/content/container'

export class FrameManager {
  private window: Cradle['window']
  private document: Cradle['document']
  private logger: Cradle['logger']
  private message: Cradle['message']

  private documentObserver: MutationObserver
  private frameAllowAttrObserver: MutationObserver
  private frames = new Map<
    HTMLIFrameElement,
    { frameId: string | null; requestIds: string[] }
  >()

  constructor({ window, document, logger, message }: Cradle) {
    Object.assign(this, {
      window,
      document,
      logger,
      message
    })

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
    this.frames.set(frame, {
      frameId: null,
      requestIds: []
    })
  }

  private async onRemovedFrame(frame: HTMLIFrameElement) {
    this.logger.info('onRemovedFrame', frame)

    const frameDetails = this.frames.get(frame)

    const stopMonetizationTags: StopMonetizationPayload[] =
      frameDetails?.requestIds.map((requestId) => ({
        requestId,
        intent: 'remove'
      })) || []
    if (stopMonetizationTags.length) {
      this.message.send({
        action: ContentToBackgroundAction.STOP_MONETIZATION,
        payload: stopMonetizationTags
      })
    }

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
    this.window.addEventListener(
      'message',
      (event: any) => {
        const { message, payload, id } = event.data
        if (
          ![
            ContentToContentAction.INITIALIZE_IFRAME,
            ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_START,
            ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_RESUME
          ].includes(message)
        ) {
          return
        }
        const frame = this.findIframe(event.source)
        if (!frame) {
          event.stopPropagation()
          return
        }

        if (event.origin === this.window.location.href) return

        switch (message) {
          case ContentToContentAction.INITIALIZE_IFRAME:
            event.stopPropagation()
            this.frames.set(frame, {
              frameId: id,
              requestIds: []
            })
            return

          case ContentToContentAction.IS_MONETIZATION_ALLOWED_ON_START:
            event.stopPropagation()
            if (frame.allow === 'monetization') {
              this.frames.set(frame, {
                frameId: id,
                requestIds: payload.map(
                  (p: StartMonetizationPayload) => p.requestId
                )
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
            event.stopPropagation()
            if (frame.allow === 'monetization') {
              this.frames.set(frame, {
                frameId: id,
                requestIds: payload.map(
                  (p: ResumeMonetizationPayload) => p.requestId
                )
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

          default:
            return
        }
      },
      { capture: true }
    )
  }
}
