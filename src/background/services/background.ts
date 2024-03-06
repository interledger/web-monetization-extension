/* eslint-disable no-case-declarations */
import { type Browser } from 'webextension-polyfill'
import {
  type ToBackgroundMessage,
  PopupToBackgroundAction
} from '@/shared/messages'
import type { OpenPaymentsService, StorageService } from '.'
import { Logger } from '@/shared/logger'
import { failure, success } from '@/shared/helpers'

export class Background {
  constructor(
    private browser: Browser,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService,
    private logger: Logger
  ) {}

  start() {
    this.bindOnInstalled()
    this.bindMessageHandler()
  }

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(
      async (message: ToBackgroundMessage) => {
        try {
          switch (message.action) {
            case PopupToBackgroundAction.GET_CONTEXT_DATA:
              return success(await this.storage.getPopupData())

            case PopupToBackgroundAction.CONNECT_WALLET:
              await this.openPaymentsService.connectWallet(message.payload)
              return

            case PopupToBackgroundAction.DISCONNECT_WALLET:
              await this.openPaymentsService.disconnectWallet()
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

  bindOnInstalled() {
    this.browser.runtime.onInstalled.addListener(async (details) => {
      this.logger.info(await this.storage.getAll())
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
