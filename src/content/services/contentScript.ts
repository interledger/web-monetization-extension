import { Logger } from '@/shared/logger'
import { MonetizationTagManager } from './monetizationTagManager'
import { type Browser } from 'webextension-polyfill'
import { BackgroundToContentAction, ToContentMessage } from '@/shared/messages'
import { failure } from '@/shared/helpers'
import { FrameManager } from './frameManager'

export class ContentScript {
  private isFirstLevelFrame: boolean
  private isTopFrame: boolean

  constructor(
    private browser: Browser,
    private window: Window,
    private logger: Logger,
    private monetizationTagManager: MonetizationTagManager,
    private frameManager: FrameManager
  ) {
    this.isTopFrame = window === window.top
    this.isFirstLevelFrame = window.parent === window.top

    this.bindMessageHandler()
  }

  start() {
    if (this.isFirstLevelFrame) {
      this.logger.info('Content script started')

      if (this.isTopFrame) this.frameManager.start()

      this.monetizationTagManager.start()
    }
  }

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(
      async (message: ToContentMessage) => {
        try {
          switch (message.action) {
            case BackgroundToContentAction.MONETIZATION_EVENT:
              this.monetizationTagManager.dispatchMonetizationEvent(
                message.payload
              )
              return

            case BackgroundToContentAction.EMIT_TOGGLE_WM:
              this.monetizationTagManager.toggleWM(message.payload)

              return

            default:
              return
          }
        } catch (e) {
          this.logger.error(message.action, e.message)
          return failure(e.message)
        }
      }
    )
  }
}
