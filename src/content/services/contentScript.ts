import { Logger } from '@/shared/logger'
import { MonetizationTagManager } from './monetizationTagManager'
import { type Browser } from 'webextension-polyfill'
import { BackgroundToContentAction, ToContentMessage } from '@/shared/messages'
import { failure } from '@/shared/helpers'

export class ContentScript {
  constructor(
    private browser: Browser,
    private logger: Logger,
    private monetizationTagManager: MonetizationTagManager
  ) {
    this.bindMessageHandler()
  }

  async start() {
    this.logger.info('Content script started')

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
