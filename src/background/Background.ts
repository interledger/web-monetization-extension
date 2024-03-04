import { type Browser } from 'webextension-polyfill'
import { type ToBackgroundMessage, PopupToBackgroundAction } from '@/shared/messages'
import type { OpenPaymentsService, StorageService } from './services'
import { success } from '@/shared/helpers'

export class Background {
  constructor(
    private browser: Browser,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService,
  ) {}

  start() {
    this.bindOnInstalled()
    this.bindMessageHandler()
  }

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(async (message: ToBackgroundMessage) => {
      switch (message.action) {
        case PopupToBackgroundAction.GET_CONTEXT_DATA:
          return success(await this.storage.getPopupData())

        case PopupToBackgroundAction.CONNECT_WALLET:
          await this.openPaymentsService.initClient('https://ilp.rafiki.money/radu')
          return

        default:
          return
      }
    })
  }

  bindOnInstalled() {
    this.browser.runtime.onInstalled.addListener(async details => {
      if (details.reason === 'install') {
        await this.storage.populate()
        await this.openPaymentsService.genererateKeys()
      }
    })
  }

  bindOnTabActivated() {
    // this.browser.tabs.onActivated.addListener()
  }

  bindOnTabUpdated() {
    // this.browser.tabs.onUpdated.addListener()
  }
}
