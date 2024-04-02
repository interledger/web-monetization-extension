import { Logger } from '@/shared/logger'
import { MonetizationTagManager } from './monetizationTagManager'
import {
  BackgroundToContentAction,
  ToBackgroundMessage
} from '@/shared/messages'
import { failure } from '@/shared/helpers'
import { Browser } from 'webextension-polyfill'

export class ContentScript {
  constructor(
    private browser: Browser,
    private logger: Logger,
    private monetizationTagManager: MonetizationTagManager
  ) {
    this.bindMessageHandler()
  }

  start() {
    this.logger.info('Content script started')

    this.monetizationTagManager.start()
  }

  bindMessageHandler() {
    console.log('bindMessageHandler')
    this.browser.runtime.onMessage.addListener(
      async (message: ToBackgroundMessage) => {
        console.log('bindMessageHandler')
        try {
          switch (message.action) {
            case BackgroundToContentAction.MONETIZATION_EVENT:
              console.log('MONETIZATION_EVENT', message.payload)
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
