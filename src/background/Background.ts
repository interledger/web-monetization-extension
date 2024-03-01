import { type Browser } from 'webextension-polyfill'

import { type PaymentFlowService } from '@/background/paymentFlow'
import { BackgroundMessage, PopupToBackgroundAction } from '@/utils/messages'

import { BrowserEventsService, EventsService, OpenPaymentsService } from './services'

class Background {
  // TO DO: remove these from background into storage or state & use injection
  grantFlow: PaymentFlowService | null = null
  spentAmount: number = 0
  paymentStarted = false

  constructor(
    private browser: Browser,
    private eventsService: EventsService,
    private browserEventsService: BrowserEventsService,
    private openPaymentsService: OpenPaymentsService,
  ) {
    chrome.storage.sync.set({ data: 'test' }, () => {
      console.log('set')
    })
  }

  subscribeToEvents() {
    this.browser.runtime.onMessage.addListener(async (message: BackgroundMessage) => {
      console.log(message)
      switch (message.action) {
        case PopupToBackgroundAction.GET_CONTEXT_DATA:
          console.log('here')
          return await this.eventsService.getStorageData()

        case PopupToBackgroundAction.CONNECT_WALLET:
          await this.openPaymentsService.initClient('https://ilp.rafiki.money/radu')
          console.log(this.openPaymentsService.client)
          return

        default:
          return
      }
    })
  }
  subscribeToBrowserEvents() {
    this.browser.runtime.onInstalled.addListener(this.browserEventsService.populateStorage)
    // TBD
    // //Add Update listener for tab
    // this.browser.tabs.onUpdated.addListener(tabUpdateHandler)
    // //Add tab change listener
    // this.browser.tabs.onActivated.addListener(tabChangeHandler)
  }
}
export default Background
