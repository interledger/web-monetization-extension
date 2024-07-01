import { type Browser } from 'webextension-polyfill'
import {
  type ToBackgroundMessage,
  PopupToBackgroundAction,
  ContentToBackgroundAction
} from '@/shared/messages'
import type {
  EventsService,
  MonetizationService,
  OpenPaymentsService,
  StorageService
} from '.'
import { Logger } from '@/shared/logger'
import { failure, getWalletInformation, success } from '@/shared/helpers'
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client/error'
import { OPEN_PAYMENTS_ERRORS } from '@/background/utils'
import { TabEvents } from './tabEvents'
import { PERMISSION_HOSTS } from '@/shared/defines'

export class Background {
  constructor(
    private browser: Browser,
    private openPaymentsService: OpenPaymentsService,
    private monetizationService: MonetizationService,
    private storage: StorageService,
    private logger: Logger,
    private tabEvents: TabEvents,
    private events: EventsService
  ) {}

  async start() {
    this.bindOnInstalled()
    this.bindMessageHandler()
    this.bindPermissionsHandler()
    this.bindStateHandler()
    this.bindTabHandlers()
    this.bindWindowHandlers()
  }

  bindWindowHandlers() {
    this.browser.windows.onFocusChanged.addListener(async () => {
      const windows = await this.browser.windows.getAll({
        windowTypes: ['normal', 'panel', 'popup']
      })
      windows.forEach(async (w) => {
        const activeTab = (
          await this.browser.tabs.query({ windowId: w.id, active: true })
        )[0]
        if (!activeTab?.id) return

        if (w.focused) {
          this.logger.debug(
            `Trying to resume monetization for window=${w.id}, activeTab=${activeTab.id} (URL: ${activeTab.url})`
          )
          void this.monetizationService.resumePaymentSessionsByTabId(
            activeTab.id
          )
        } else {
          this.logger.debug(
            `Trying to pause monetization for window=${w.id}, activeTab=${activeTab.id} (URL: ${activeTab.url})`
          )
          void this.monetizationService.stopPaymentSessionsByTabId(activeTab.id)
        }
      })
    })
  }

  bindTabHandlers() {
    this.browser.tabs.onRemoved.addListener(this.tabEvents.clearTabSessions)
    this.browser.tabs.onUpdated.addListener(this.tabEvents.clearTabSessions)
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
              return success(await this.monetizationService.getPopupData())

            case PopupToBackgroundAction.CONNECT_WALLET:
              await this.openPaymentsService.connectWallet(message.payload)
              return

            case PopupToBackgroundAction.DISCONNECT_WALLET:
              await this.openPaymentsService.disconnectWallet()
              return

            case PopupToBackgroundAction.TOGGLE_WM:
              await this.monetizationService.toggleWM()
              await this.tabEvents.onUpdatedTab()
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
              await this.monetizationService.stopPaymentSession(
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
                await this.storage.updateRate(message.payload.rateOfPay)
              )

            case ContentToBackgroundAction.IS_TAB_MONETIZED:
              await this.tabEvents.onUpdatedTab(message.payload, sender)
              return

            case ContentToBackgroundAction.IS_WM_ENABLED:
              return success(await this.storage.getWMState())

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

  bindPermissionsHandler() {
    this.browser.permissions.onAdded.addListener(this.checkPermissions)
    this.browser.permissions.onRemoved.addListener(this.checkPermissions)
  }

  bindStateHandler() {
    this.events.on('storage.state_update', async ({ state, prevState }) => {
      this.logger.info('state changed', { state, prevState })
      // TODO: change icon here in future
    })
  }

  bindOnInstalled() {
    this.browser.runtime.onInstalled.addListener(async (details) => {
      const data = await this.storage.get()
      this.logger.info(data)
      if (details.reason === 'install') {
        await this.storage.populate()
        await this.openPaymentsService.generateKeys()
      } else if (details.reason === 'update') {
        const migrated = await this.storage.migrate()
        if (migrated) {
          const prevVersion = data.version ?? 1
          this.logger.info(
            `Migrated from ${prevVersion} to ${migrated.version}`
          )
        }
      }
      await this.checkPermissions()
    })
  }

  checkPermissions = async () => {
    try {
      this.logger.debug('checking hosts permission')
      const hasPermissions =
        await this.browser.permissions.contains(PERMISSION_HOSTS)
      this.storage.setState({ missing_host_permissions: !hasPermissions })
    } catch (error) {
      this.logger.error(error)
    }
  }
}
