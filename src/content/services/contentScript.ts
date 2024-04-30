import { Logger } from '@/shared/logger'
import { MonetizationTagManager } from './monetizationTagManager'
import { type Browser } from 'webextension-polyfill'
import { BackgroundToContentAction, ToContentMessage } from '@/shared/messages'
import { failure } from '@/shared/helpers'
import { FrameManager } from './frameManager'

export class ContentScript {
  constructor(
    private browser: Browser,
    private window: Window,
    private logger: Logger,
    private monetizationTagManager: MonetizationTagManager,
    private frameManager: FrameManager
  ) {
    this.bindMessageHandler()
    this.frameManager.isTopFrame = window === window.top
    this.frameManager.isFirstLevelFrame = window.parent === window.top
  }

  start() {
    this.logger.info('Content script started')
    this.frameManager.start()

    this.monetizationTagManager.start()
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
