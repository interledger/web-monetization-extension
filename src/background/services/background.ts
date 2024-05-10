import { type Browser } from 'webextension-polyfill'
import {
  type ToBackgroundMessage,
  PopupToBackgroundAction,
  ContentToBackgroundAction
} from '@/shared/messages'
import type {
  MonetizationService,
  OpenPaymentsService,
  StorageService
} from '.'
import { Logger } from '@/shared/logger'
import { failure, getWalletInformation, success } from '@/shared/helpers'
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client/error'
import { OPEN_PAYMENTS_ERRORS } from '@/background/utils'
import { TabEvents } from './tabEvents'

export class Background {
  constructor(
    private browser: Browser,
    private openPaymentsService: OpenPaymentsService,
    private monetizationService: MonetizationService,
    private storage: StorageService,
    private logger: Logger,
    private tabEvents: TabEvents
  ) {}

  async start() {
    this.bindOnInstalled()
    this.bindMessageHandler()
    this.bindTabHandlers()
  }

  bindTabHandlers() {
    this.browser.tabs.onRemoved.addListener(this.tabEvents.onRemovedTab)
    this.browser.tabs.onCreated.addListener(this.tabEvents.onCreatedTab)
    this.browser.tabs.onActivated.addListener(this.tabEvents.onActivatedTab)
  }

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(
      async (message: ToBackgroundMessage, sender) => {
        this.logger.debug('Received message', message)
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

            case PopupToBackgroundAction.TOGGLE_WM:
              await this.monetizationService.toggleWM()

              this.tabEvents.onUpdatedTab()
              return

            case PopupToBackgroundAction.TOGGLE_CONTINOUS_PAYMENT:
              await this.monetizationService.toggleContinousPayment()
              return

            case PopupToBackgroundAction.PAY_WEBSITE:
              return success(
                await this.monetizationService.pay(message.payload.amount)
              )

            case ContentToBackgroundAction.CHECK_WALLET_ADDRESS_URL:
              return success(
                await getWalletInformation(message.payload.walletAddressUrl)
              )

            case ContentToBackgroundAction.START_MONETIZATION:
              await this.monetizationService.startPaymentSession(
                message.payload,
                sender
              )
              return

            case ContentToBackgroundAction.STOP_MONETIZATION:
              this.monetizationService.stopPaymentSession(
                message.payload,
                sender
              )
              return

            case ContentToBackgroundAction.RESUME_MONETIZATION:
              this.monetizationService.resumePaymentSession(
                message.payload,
                sender
              )
              return

            case PopupToBackgroundAction.UPDATE_RATE_OF_PAY:
              return success(
                await this.storage.set({
                  rateOfPay: message.payload.rateOfPay
                })
              )

            case ContentToBackgroundAction.IS_TAB_MONETIZED:
              this.tabEvents.onUpdatedTab(message.payload)
              return

            case ContentToBackgroundAction.IS_WM_ENABLED:
              return success(await this.storage.getWMState())

            case ContentToBackgroundAction.IS_CONTINOUS_PAYMENT_ENABLED:
              return success(await this.storage.getContinousPaymentState())

            default:
              return
          }
        } catch (e) {
          if (e instanceof OpenPaymentsClientError) {
            this.logger.error(message.action, e.message, e.description)
            return failure(OPEN_PAYMENTS_ERRORS[e.description] ?? e.description)
          }
          this.logger.error(message.action, e.message)
          return failure(e.message)
        }
      }
    )
  }

  bindOnInstalled() {
    this.browser.runtime.onInstalled.addListener(async (details) => {
      this.logger.info(await this.storage.get())
      if (details.reason === 'install') {
        await this.storage.populate()
        await this.openPaymentsService.genererateKeys()
      }
    })
  }
}
