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
import {
  computeRate,
  getCurrentActiveTab,
  getSender,
  getTab,
  removeQueryParams
} from '../utils'
import { EventsService } from './events'
import { ALLOWED_PROTOCOLS } from '@/shared/defines'
import type { PopupStore } from '@/shared/types'
import { TabState } from './tabState'

export class MonetizationService {
  constructor(
    private logger: Logger,
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
      enabled,
      rateOfPay,
      connected,
      walletAddress: connectedWallet
    } = await this.storage.get([
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
    const sessions = this.tabState.getSessions(tab)

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
        this.tabState,
        removeQueryParams(url!)
      )

      sessions.set(requestId, session)

      if (connected === true && enabled === true) {
        void session.start()
      }
    })
  }

  async stopPaymentSessionsByTabId(tabId: number) {
    const { enabled, connected } = await this.storage.get([
      'connected',
      'enabled'
    ])
    if (connected === false || enabled === false) return

    const tab = await this.getTabById(tabId)
    if (!tab) {
      this.logger.warn(`Tab ${tabId} not found.`)
      return
    }
    const sessions = this.tabState.getSessions(tab)
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
    const tab = getTab(sender)
    const sessions = this.tabState.getSessions(tab)

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tab.id}.`)
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

  resumePaymentSession(
    payload: ResumeMonetizationPayload[],
    sender: Runtime.MessageSender
  ) {
    const tab = getTab(sender)
    const sessions = this.tabState.getSessions(tab)

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tab.id}.`)
      return
    }

    payload.forEach((p) => {
      const { requestId } = p

      sessions.get(requestId)?.resume()
    })
  }

  async resumePaymentSessionsByTabId(tabId: number) {
    const { enabled, connected } = await this.storage.get([
      'connected',
      'enabled'
    ])
    if (connected === false || enabled === false) return

    const tab = await this.getTabById(tabId)
    if (!tab) {
      this.logger.warn(`Tab ${tabId} not found.`)
      return
    }
    const sessions = this.tabState.getSessions(tab)
    if (!sessions?.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    for (const session of sessions.values()) {
      session.resume()
    }
  }

  async toggleWM() {
    const { enabled } = await this.storage.get(['enabled'])
    await this.storage.set({ enabled: !enabled })
    emitToggleWM({ enabled: !enabled })
  }

  async clearTabSessions(tabId: number) {
    this.logger.debug(`Attempting to clear sessions for tab ${tabId}.`)
    const tab = await this.getTabById(tabId)
    if (!tab) return
    const sessions = this.tabState.getSessions(tab)

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    for (const session of sessions.values()) {
      session.stop()
    }

    sessions.clear()
    this.logger.debug(`Cleared ${sessions.size} sessions for tab ${tabId}.`)
  }

  async pay(amount: string) {
    const tab = await getCurrentActiveTab(this.browser)
    if (!tab || !tab.id) {
      throw new Error('Could not find active tab.')
    }
    const sessions = this.tabState.getSessions(tab)
    if (!sessions.size) {
      throw new Error('This website is not monetized.')
    }

    const splitAmount = Number(amount) / sessions.size

    const results = await Promise.allSettled(
      [...sessions.values()].map((session) => session.pay(splitAmount))
    )

    const totalSentAmount = results
      .filter((r) => r.status === 'fulfilled')
      .reduce((acc, r) => acc + BigInt(r.value?.value ?? 0), BigInt(0))
    if (totalSentAmount === BigInt(0)) {
      throw new Error('Could not facilitate payment for current website.')
    }
  }

  private registerEventListeners() {
    this.onRateOfPayUpdate()
  }

  private onRateOfPayUpdate() {
    this.events.on('storage.rate_of_pay_update', async ({ rate }) => {
      this.logger.debug("Received event='storage.rate_of_pay_update'")
      const tabs = await this.browser.tabs.query({})
      for (const tab of tabs) {
        if (!tab.id) continue
        this.logger.debug(`Re-evaluating sessions amount for tab=${tab.id}`)
        const tabSessions = this.tabState.getSessions(tab)
        for (const session of tabSessions.values()) {
          session.adjustSessionAmount(rate)
        }
      }
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
    const isSiteMonetized = this.tabState.getSessions(tab).size > 0

    return {
      ...storedData,
      balance: balance.total.toString(),
      url,
      isSiteMonetized
    }
  }

  private async getTabById(tabId: number) {
    return await this.browser.tabs.get(tabId)
  }
}
