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
    if (!payload.length) {
      throw new Error('Unexpected: payload is empty')
    }
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

    // Initialize new sessions
    payload.forEach((p) => {
      const { requestId, walletAddress: receiver } = p

      sessions.get(requestId)?.stop()
      sessions.delete(requestId)

      const session = new PaymentSession(
        receiver,
        connectedWallet,
        requestId,
        tabId,
        frameId,
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
    const rate = computeRate(rateOfPay, sessions.size)
    await Promise.all(sessionsArr.map((session) => session.adjustAmount(rate)))

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
    let needsAdjustAmount = false
    const tabId = getTabId(sender)
    const sessions = this.tabState.getSessions(tabId)

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    payload.forEach((p) => {
      const { requestId } = p

      const session = sessions.get(requestId)
      if (!session) return

      if (p.intent === 'remove') {
        needsAdjustAmount = true
        session.stop()
        sessions.delete(requestId)
      } else if (p.intent === 'disable') {
        needsAdjustAmount = true
        session.disable()
      } else {
        session.stop()
      }
    })

    const { rateOfPay } = await this.storage.get(['rateOfPay'])
    if (!rateOfPay) return

    if (needsAdjustAmount) {
      const rate = computeRate(rateOfPay, sessions.size)
      const sessionsArr = Array.from(sessions.values())
      await Promise.all(
        sessionsArr.map((session) => session.adjustAmount(rate))
      )
    }
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
    this.events.on('storage.rate_of_pay_update', async ({ rate }) => {
      this.logger.debug("Received event='storage.rate_of_pay_update'")
      const tabIds = this.tabState.getAllTabs()

      // Move the current active tab to the front of the array
      const currentTab = await getCurrentActiveTab(this.browser)
      if (currentTab?.id) {
        const idx = tabIds.indexOf(currentTab.id)
        const tmp = tabIds[0]
        tabIds[0] = currentTab.id
        tabIds[idx] = tmp
      }

      for (const tabId of tabIds) {
        const sessions = [...this.tabState.getSessions(tabId).values()]
        const computedRate = computeRate(rate, sessions.length)
        await Promise.all(
          sessions.map((session) => session.adjustAmount(computedRate))
        )
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

/*
- ON PAGE LOAD:
  * we get all monetization links that are not disabled and we send the `START_MONETIZATION` event

- A NEW MONETIZATION LINK GETS ADDED
  * we send the `START_MONETIZATION` event for the new monetization link

- A MONETIZATION LINK GETS REMOVED
  * we send the `STOP_MONETIZATION` event for the removed monetization link with the `intent` set to `remove` and we readjust the amount

- A MONETIZATION LINK GETS DISABLED
  * we send the `STOP_MONETIZATION` event for the disabled monetization link with the `intent` set to `disable` and we readjust the amount

- A MONETIZATION LINK GETS ENABLED
  * we send the `START_MONETIZATION` event and replace the previous session with a new one with the same requestId and we readjust the amount
  !! we send the `RESUME_MONETIZATION` event for the enabled tag

- THE HREF ATTRIBUTE IS UPDATED
  * we send the `STOP_MONETIZATION` event for the updated monetization link with the `intent` set to `remove` and we send the `START_MONETIZATION` event for the new monetization link
**/
