import { OpenPaymentsService, StorageService } from '.'
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
import { isOkState, removeQueryParams } from '@/shared/helpers'
import { EventsService } from './events'
import { ALLOWED_PROTOCOLS } from '@/shared/defines'
import type { PopupStore } from '@/shared/types'
import { TabState } from './tabState'

export class MonetizationService {
  private sessions: {
    [tabId: number]: Map<string, PaymentSession>
  }

  constructor(
    private logger: Logger,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService,
    private browser: Browser,
    private events: EventsService,
    private tabState: TabState
  ) {
    this.sessions = {}
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
    const { tabId, frameId, url, tab } = getSender(sender)

    if (this.sessions[tabId] == null) {
      this.sessions[tabId] = new Map()
    }

    const sessions = this.sessions[tabId]
    const sessionsCount = sessions.size + payload.length
    const rate = computeRate(rateOfPay, sessionsCount)

    // Adjust rate of payment for existing sessions
    sessions.forEach((session) => {
      session.adjustSessionAmount(rate)
    })

    // Initialize new sessions
    payload.forEach((p) => {
      const { requestId, walletAddress: receiver } = p

      const session = new PaymentSession(
        receiver,
        connectedWallet,
        requestId,
        tab,
        tabId,
        frameId,
        rate,
        this.openPaymentsService,
        this.events,
        this.tabState,
        removeQueryParams(url!)
      )

      sessions.set(requestId, session)

      if (connected && enabled && isOkState(state)) {
        void session.start()
      }
    })
  }

  async stopPaymentSessionsByTabId(tabId: number) {
    const sessions = this.sessions[tabId]

    if (!sessions?.size) {
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
    const sessions = this.sessions[tabId]

    if (!sessions) {
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
    sessions.forEach((session) => {
      session.adjustSessionAmount(rate)
    })
  }

  async resumePaymentSession(
    payload: ResumeMonetizationPayload[],
    sender: Runtime.MessageSender
  ) {
    const tabId = getTabId(sender)
    const sessions = this.sessions[tabId]

    if (!sessions?.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    const { state, connected, enabled } = await this.storage.get([
      'state',
      'connected',
      'enabled'
    ])
    if (!isOkState(state) || !connected || !enabled) return

    payload.forEach((p) => {
      const { requestId } = p

      sessions.get(requestId)?.resume()
    })
  }

  async resumePaymentSessionsByTabId(tabId: number) {
    const sessions = this.sessions[tabId]
    if (!sessions?.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    const { state, connected, enabled } = await this.storage.get([
      'state',
      'connected',
      'enabled'
    ])
    if (!isOkState(state) || !connected || !enabled) return

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
    const sessions = this.sessions[tabId]

    if (!sessions) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    for (const session of sessions.values()) {
      session.stop()
    }

    delete this.sessions[tabId]
    this.logger.debug(`Cleared ${sessions.size} sessions for tab ${tabId}.`)
  }

  async pay(amount: string) {
    const tab = await getCurrentActiveTab(this.browser)
    if (!tab || !tab.id) {
      throw new Error('Could not find active tab.')
    }

    const sessions = this.sessions[tab.id]

    if (!sessions?.size) {
      throw new Error('This website is not monetized.')
    }

    let totalSentAmount = BigInt(0)
    const splitAmount = Number(amount) / sessions.size
    const promises = []

    for (const session of sessions.values()) {
      promises.push(session.pay(splitAmount))
    }

    ;(await Promise.allSettled(promises)).forEach((p) => {
      if (p.status === 'fulfilled') {
        totalSentAmount += BigInt(p.value?.value ?? 0)
      }
    })

    if (totalSentAmount === BigInt(0)) {
      throw new Error('Could not facilitate payment for current website.')
    }
  }

  private registerEventListeners() {
    this.onRateOfPayUpdate()
    this.onKeyRevoked()
    this.onOutOfFunds()
  }

  private onRateOfPayUpdate() {
    this.events.on('storage.rate_of_pay_update', ({ rate }) => {
      this.logger.debug("Received event='storage.rate_of_pay_update'")
      Object.keys(this.sessions).forEach((tabId) => {
        const tabSessions = this.sessions[tabId as unknown as number]
        this.logger.debug(`Re-evaluating sessions amount for tab=${tabId}`)
        for (const session of tabSessions.values()) {
          session.adjustSessionAmount(rate)
        }
      })
    })
  }

  private onKeyRevoked() {
    this.events.once('open_payments.key_revoked', async () => {
      this.logger.warn(`Key revoked. Stopping all payment sessions.`)
      for (const sessions of Object.values(this.sessions)) {
        for (const session of sessions.values()) {
          session.stop()
        }
      }
      await this.storage.setState({ key_revoked: true })
      this.logger.debug(`All payment sessions stopped.`)
      this.onKeyRevoked() // setup listener again once all is done
    })
  }

  private onOutOfFunds() {
    this.events.once('open_payments.out_of_funds', async () => {
      this.logger.warn(`Out of funds. Stopping all payment sessions.`)
      for (const sessions of Object.values(this.sessions)) {
        for (const session of sessions.values()) {
          session.stop()
        }
      }
      await this.storage.setState({ out_of_funds: true })
      this.logger.debug(`All payment sessions stopped.`)
      this.onOutOfFunds() // setup listener again once all is done
    })
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
      'publicKey'
    ])
    const balance = await this.storage.getBalance()
    const tab = await getCurrentActiveTab(this.browser)

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
    const isSiteMonetized = tab?.id ? this.sessions[tab.id]?.size > 0 : false

    return {
      ...storedData,
      balance: balance.total.toString(),
      url,
      isSiteMonetized
    }
  }
}
