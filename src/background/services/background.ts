/* eslint-disable no-case-declarations */
import { type Browser } from 'webextension-polyfill'
import {
  type ToBackgroundMessage,
  PopupToBackgroundAction,
  ContentToBackgroundAction
} from '@/shared/messages'
import type {
  MonetizationService,
  OpenPaymentsService,
  StorageService,
  StreamsService
} from '.'
import { Logger } from '@/shared/logger'
import { failure, getWalletInformation, success } from '@/shared/helpers'
import { WalletAddress } from '@interledger/open-payments/dist/types'
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client/error'
import { OPEN_PAYMENTS_ERRORS } from '@/background/utils'
import { sendMonetizationEvent } from '@/background/lib/messages'

export class Background {
  constructor(
    private browser: Browser,
    private openPaymentsService: OpenPaymentsService,
    private monetizationService: MonetizationService,
    private storage: StorageService,
    private logger: Logger,
    private streamsService: StreamsService
  ) {}

  async start() {
    this.bindOnInstalled()
    this.bindMessageHandler()

    // @TODO: Remove this - testing monetization event from background
    await sendMonetizationEvent({
      requestId: '123',
      details: {
        amount: '100'
      }
    })
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

            case PopupToBackgroundAction.TOGGLE_WM:
              await this.monetizationService.toggleWM()
              return

            case PopupToBackgroundAction.PAY_WEBSITE:
              await this.monetizationService.start()
              return
            // this.logger.debug(
            //   PopupToBackgroundAction.PAY_WEBSITE,
            //   message.payload
            // )
            // throw new Error('Not implemented')

            case ContentToBackgroundAction.CHECK_WALLET_ADDRESS_URL:
              return success(
                await getWalletInformation(message.payload.walletAddressUrl)
              )

            case ContentToBackgroundAction.START_MONETIZATION:
              const { requestId, walletAddress } = message.payload
              this.streamsService.streams[requestId as string] = {
                ...(walletAddress as WalletAddress)
              }
              return

            case ContentToBackgroundAction.STOP_MONETIZATION:
              // const { requestId } = message.payload
              // @TODO update this to stop the stream
              return

            case ContentToBackgroundAction.RESUME_MONETIZATION:
              // const { requestId } = message.payload
              // @TODO update this to resume the stream
              return

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

  bindOnTabActivated() {
    // this.browser.tabs.onActivated.addListener()
  }

  bindOnTabUpdated() {
    // this.browser.tabs.onUpdated.addListener()
  }
}
