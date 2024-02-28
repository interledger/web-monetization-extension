import { type Browser } from 'webextension-polyfill'

import { type PaymentFlowService } from '@/background/paymentFlow'
import { setStorageDefaultData } from '@/utils/storage'
import { EXTMessage } from '@/utils/types'

import { generateKeysHandler } from './installHandlers'
import { BrowserEventsService, EventsService } from './services'
import { tabChangeHandler, tabUpdateHandler } from './tabHandlers'

class Background {
  // TO DO: remove these from background into storage or state & use injection
  grantFlow: PaymentFlowService | null = null
  spentAmount: number = 0
  paymentStarted = false

  constructor(
    private browser: Browser,
    private eventsService: EventsService,
    private browserEventsService: BrowserEventsService,
  ) {
    setStorageDefaultData()
  }

  subscribeToEvents() {
    this.browser.runtime.onMessage.addListener(async (message: EXTMessage) => {
      switch (message.type) {
        case 'GET_STORAGE_DATA':
          return await this.eventsService.getStorageData()

        default:
          return
      }
    })
  }
  subscribeToBrowserEvents() {
    this.browser.runtime.onInstalled.addListener(this.browserEventsService.generateKeysHandler)
    // TBD
    // //Add Update listener for tab
    // this.browser.tabs.onUpdated.addListener(tabUpdateHandler)
    // //Add tab change listener
    // this.browser.tabs.onActivated.addListener(tabChangeHandler)
  }
}
export default Background
