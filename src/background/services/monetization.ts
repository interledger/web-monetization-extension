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
import { getCurrentActiveTab, getSender, getTabId } from '../utils'
import { EventsService } from './events'

export class MonetizationService {
  private sessions: {
    [tabId: number]: Map<string, PaymentSession>
  }

  constructor(
    private logger: Logger,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService,
    private browser: Browser,
    private events: EventsService
  ) {
    this.sessions = {}
    this.registerEventListeners()
  }

  async startPaymentSession(
    payload: StartMonetizationPayload,
    sender: Runtime.MessageSender
  ) {
    const {
      connected,
      enabled,
      rateOfPay: rate,
      walletAddress: connectedWallet
    } = await this.storage.get([
      'enabled',
      'connected',
      'rateOfPay',
      'walletAddress'
    ])

    if (!rate || !connectedWallet) {
      this.logger.error(
        `Did not find rate of pay or connect wallet information. Received rate=${rate}, wallet=${connectedWallet}. Payment session will not be initialized.`
      )
      return
    }

    const { requestId, walletAddress: receiver } = payload
    const { tabId, frameId } = getSender(sender)

    if (this.sessions[tabId] == null) {
      this.sessions[tabId] = new Map()
    }

    // TODO: Split monetization amount (needs batching)

    const session = new PaymentSession(
      receiver,
      connectedWallet,
      requestId,
      tabId,
      frameId,
      rate,
      this.openPaymentsService,
      this.storage
    )

    this.sessions[tabId].set(requestId, session)

    if (connected === true && enabled === true) {
      void session.start()
    }
  }

  async stopPaymentSessionsByTabId(tabId: number) {
    const { enabled, connected } = await this.storage.get([
      'connected',
      'enabled'
    ])
    if (connected === false || enabled === false) return

    const sessions = this.sessions[tabId]

    if (!sessions) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    for (const session of sessions.values()) {
      session.stop()
    }
  }

  stopPaymentSession(
    payload: StopMonetizationPayload,
    sender: Runtime.MessageSender
  ) {
    const { requestId } = payload
    const tabId = getTabId(sender)
    const sessions = this.sessions[tabId]

    if (!sessions) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    this.sessions[tabId].get(requestId)?.stop()
  }

  resumePaymentSession(
    payload: ResumeMonetizationPayload,
    sender: Runtime.MessageSender
  ) {
    const { requestId } = payload
    const tabId = getTabId(sender)
    const sessions = this.sessions[tabId]

    if (!sessions) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`)
      return
    }

    this.sessions[tabId].get(requestId)?.resume()
  }

  async resumePaymentSessionsByTabId(tabId: number) {
    const { enabled, connected } = await this.storage.get([
      'connected',
      'enabled'
    ])
    if (connected === false || enabled === false) return

    const sessions = this.sessions[tabId]

    if (!sessions) {
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
    if (!tab || !tab.id) return

    const sessions = this.sessions[tab.id]

    if (!sessions) {
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
  }

  private onRateOfPayUpdate() {
    this.events.on('storage.rate_of_pay_update', ({ rate }) => {
      this.logger.debug("Recevied event='storage.rate_of_pay_update'")
      Object.keys(this.sessions).forEach((tabId) => {
        const tabSessions = this.sessions[tabId as unknown as number]
        this.logger.debug(`Re-evaluating sessions amount for tab=${tabId}`)
        for (const session of tabSessions.values()) {
          session.adjustSessionAmount(rate)
        }
      })
    })
  }
}
