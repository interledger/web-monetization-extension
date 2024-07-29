import type {
  EventsService,
  OpenPaymentsService,
  StorageService,
  TabState
} from '.'
import { type Browser, type Runtime } from 'webextension-polyfill'
import { Logger } from '@/shared/logger'
import {
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload
} from '@/shared/messages'
import { PaymentSession } from './paymentSession'
import { emitToggleWM } from '../lib/messages'
import { computeRate, getCurrentActiveTab, getSender, getTabId } from '../utils'
import { isOutOfBalanceError } from './openPayments'
import {
  isOkState,
  removeQueryParams,
  type Translation
} from '@/shared/helpers'
import { ALLOWED_PROTOCOLS } from '@/shared/defines'
import type { PopupStore, Storage } from '@/shared/types'

export class MonetizationService {
  constructor(
    private logger: Logger,
    private t: Translation,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService,
    private browser: Browser,
    private events: EventsService,
    private tabState: TabState
  ) {
    this.registerEventListeners()
  }

  async startPaymentSession(
    payload: StartMonetizationPayload[],
    sender: Runtime.MessageSender
  ) {
    const {
      state,
      enabled,
      rateOfPay,
      connected,
      walletAddress: connectedWallet
    } = await this.storage.get([
      'state',
      'enabled',
      'connected',
      'rateOfPay',
      'walletAddress'
    ])

    if (!rateOfPay || !connectedWallet) {
      this.logger.error(
        `Did not find rate of pay or connect wallet information. Received rate=${rateOfPay}, wallet=${connectedWallet}. Payment session will not be initialized.`
      )
      return
    }
    const { tabId, frameId, url } = getSender(sender)
    const sessions = this.tabState.getSessions(tabId)

    const sessionsCount = sessions.size + payload.length
    const rate = computeRate(rateOfPay, sessionsCount)

    // // Adjust rate of payment for existing sessions
    // sessions.forEach((session) => {
    //   session.adjustSessionAmount(rate)
    // })

    // Initialize new sessions
    payload.forEach((p) => {
      const { requestId, walletAddress: receiver } = p

      const session = new PaymentSession(
        receiver,
        connectedWallet,
        requestId,
        tabId,
        frameId,
        rate,
        this.openPaymentsService,
        this.events,
        this.tabState,
        removeQueryParams(url!)
      )

      sessions.set(requestId, session)
    })

    const sessionsArr = Array.from(sessions.values())

    // Since we probe (through quoting) the debitAmount we have to await the
    // `adjustAmount` method.
    await Promise.all(sessionsArr.map((session) => session.adjustAmount()))

    if (enabled && this.canTryPayment(connected, state)) {
      sessionsArr.forEach((session) => {
        void session.start()
      })
    }
  }

  async stopPaymentSessionsByTabId(tabId: number) {
    const sessions = this.tabState.getSessions(tabId)
    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    for (const session of sessions.values()) {
      session.stop()
    }
  }

  async stopPaymentSession(
    payload: StopMonetizationPayload[],
    sender: Runtime.MessageSender
  ) {
    const tabId = getTabId(sender)
    const sessions = this.tabState.getSessions(tabId)

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    payload.forEach((p) => {
      const { requestId } = p

      sessions.get(requestId)?.stop()

      if (p.remove) {
        sessions.delete(requestId)
      }
    })

    const { rateOfPay } = await this.storage.get(['rateOfPay'])
    if (!rateOfPay) return

    const rate = computeRate(rateOfPay, sessions.size)
    // Adjust rate of payment for existing sessions

    // TODO: Only adjust the amount if a wallet address gets removed.
    // At the moment whenever we switch tabs, the `adjustAmount` method
    // is called, making at least 2 unnecessary probe requests.
    sessions.forEach((session) => {
      session.adjustAmount(rate)
    })
  }

  async resumePaymentSession(
    payload: ResumeMonetizationPayload[],
    sender: Runtime.MessageSender
  ) {
    const tabId = getTabId(sender)
    const sessions = this.tabState.getSessions(tabId)

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    const { state, connected, enabled } = await this.storage.get([
      'state',
      'connected',
      'enabled'
    ])
    if (!enabled || !this.canTryPayment(connected, state)) return

    payload.forEach((p) => {
      const { requestId } = p

      sessions.get(requestId)?.resume()
    })
  }

  async resumePaymentSessionsByTabId(tabId: number) {
    const sessions = this.tabState.getSessions(tabId)
    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    const { state, connected, enabled } = await this.storage.get([
      'state',
      'connected',
      'enabled'
    ])
    if (!enabled || !this.canTryPayment(connected, state)) return

    for (const session of sessions.values()) {
      session.resume()
    }
  }

  async resumePaymentSessionActiveTab() {
    const currentTab = await getCurrentActiveTab(this.browser)
    if (!currentTab?.id) return
    await this.resumePaymentSessionsByTabId(currentTab.id)
  }

  async toggleWM() {
    const { enabled } = await this.storage.get(['enabled'])
    await this.storage.set({ enabled: !enabled })
    emitToggleWM({ enabled: !enabled })
  }

  clearTabSessions(tabId: number) {
    this.logger.debug(`Attempting to clear sessions for tab ${tabId}.`)
    const sessions = this.tabState.getSessions(tabId)

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    for (const session of sessions.values()) {
      session.stop()
    }

    this.tabState.clearByTabId(tabId)

    this.logger.debug(`Cleared ${sessions.size} sessions for tab ${tabId}.`)
  }

  async pay(amount: string) {
    const tab = await getCurrentActiveTab(this.browser)
    if (!tab || !tab.id) {
      throw new Error('Could not find active tab.')
    }
    const sessions = this.tabState.getSessions(tab.id)
    if (!sessions.size) {
      throw new Error('This website is not monetized.')
    }

    const splitAmount = Number(amount) / sessions.size
    // TODO: handle paying across two grants (when one grant doesn't have enough funds)
    const results = await Promise.allSettled(
      Array.from(sessions.values()).map((session) => session.pay(splitAmount))
    )

    const totalSentAmount = results
      .filter((e) => e.status === 'fulfilled')
      .reduce((acc, curr) => acc + BigInt(curr.value?.value ?? 0), 0n)
    if (totalSentAmount === 0n) {
      const isNotEnoughFunds = results
        .filter((e) => e.status === 'rejected')
        .some((e) => isOutOfBalanceError(e.reason))
      if (isNotEnoughFunds) {
        throw new Error(this.t('pay_error_notEnoughFunds'))
      }
      throw new Error('Could not facilitate payment for current website.')
    }
  }

  private canTryPayment(
    connected: Storage['connected'],
    state: Storage['state']
  ): boolean {
    if (!connected) return false
    if (isOkState(state)) return true

    if (state.out_of_funds && this.openPaymentsService.isAnyGrantUsable()) {
      // if we're in out_of_funds state, we still try to make payments hoping we
      // have funds available now. If a payment succeeds, we move out from
      // of_out_funds state.
      return true
    }

    return false
  }

  private registerEventListeners() {
    this.onRateOfPayUpdate()
    this.onKeyRevoked()
    this.onOutOfFunds()
  }

  private onRateOfPayUpdate() {
    this.events.on('storage.rate_of_pay_update', ({ rate }) => {
      this.logger.debug("Received event='storage.rate_of_pay_update'")
      for (const session of this.tabState.getAllSessions()) {
        session.adjustAmount(rate)
      }
    })
  }

  private onKeyRevoked() {
    this.events.once('open_payments.key_revoked', async () => {
      this.logger.warn(`Key revoked. Stopping all payment sessions.`)
      this.stopAllSessions()
      await this.storage.setState({ key_revoked: true })
      this.onKeyRevoked() // setup listener again once all is done
    })
  }

  private onOutOfFunds() {
    this.events.once('open_payments.out_of_funds', async () => {
      this.logger.warn(`Out of funds. Stopping all payment sessions.`)
      this.stopAllSessions()
      await this.storage.setState({ out_of_funds: true })
      this.onOutOfFunds() // setup listener again once all is done
    })
  }

  private stopAllSessions() {
    for (const session of this.tabState.getAllSessions()) {
      session.stop()
    }
    this.logger.debug(`All payment sessions stopped.`)
  }

  async getPopupData(): Promise<PopupStore> {
    const storedData = await this.storage.get([
      'enabled',
      'connected',
      'state',
      'rateOfPay',
      'minRateOfPay',
      'maxRateOfPay',
      'walletAddress',
      'oneTimeGrant',
      'recurringGrant',
      'publicKey'
    ])
    const balance = await this.storage.getBalance()
    const tab = await getCurrentActiveTab(this.browser)

    const { oneTimeGrant, recurringGrant, ...dataFromStorage } = storedData

    let url
    if (tab && tab.url) {
      try {
        const tabUrl = new URL(tab.url)
        if (ALLOWED_PROTOCOLS.includes(tabUrl.protocol)) {
          // Do not include search params
          url = `${tabUrl.origin}${tabUrl.pathname}`
        }
      } catch (_) {
        // noop
      }
    }
    const isSiteMonetized = this.tabState.getSessions(tab.id!).size > 0

    return {
      ...dataFromStorage,
      balance: balance.total.toString(),
      url,
      grants: {
        oneTime: oneTimeGrant?.amount,
        recurring: recurringGrant?.amount
      },
      isSiteMonetized
    }
  }
}
