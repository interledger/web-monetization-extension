import { OpenPaymentsService, StorageService } from '.'
import { type Browser, type Runtime } from 'webextension-polyfill'
import { Logger } from '@/shared/logger'
import {
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload
} from '@/shared/messages'
import { PaymentSession } from './paymentSession'
import { emitToggleWM, emitToggleContinousPayment } from '../lib/messages'
import { getCurrentActiveTab, getSender, getTabId } from '../utils'

export class MonetizationService {
  private sessions: {
    [tabId: number]: Map<string, PaymentSession>
  }

  constructor(
    private logger: Logger,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService,
    private browser: Browser
  ) {
    this.sessions = {}
  }

  async startPaymentSession(
    payload: StartMonetizationPayload,
    sender: Runtime.MessageSender
  ) {
    const { connected, enabled, enabledContinousPayment } =
      await this.storage.get([
        'enabled',
        'connected',
        'enabledContinousPayment'
      ])

    const { requestId, walletAddress } = payload
    const { tabId, frameId } = getSender(sender)

    if (this.sessions[tabId] == null) {
      this.sessions[tabId] = new Map()
    }

    const { rateOfPay: rate } = await this.storage.get(['rateOfPay'])

    if (!rate) {
      this.logger.error(
        'Rate of pay not found. Payment session will not be initialized.'
      )
      return
    }

    const session = new PaymentSession(
      walletAddress,
      requestId,
      tabId,
      frameId,
      rate,
      this.openPaymentsService,
      this.storage
    )

    this.sessions[tabId].set(requestId, session)

    if (
      connected === true &&
      enabled === true &&
      enabledContinousPayment === true
    ) {
      void session.start()
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

  async toggleWM() {
    const { enabled } = await this.storage.get(['enabled'])
    await this.storage.set({ enabled: !enabled })
    emitToggleWM({ enabled: !enabled })
  }

  async toggleContinousPayment() {
    const { enabledContinousPayment } = await this.storage.get([
      'enabledContinousPayment'
    ])
    await this.storage.set({
      enabledContinousPayment: !enabledContinousPayment
    })
    emitToggleContinousPayment({
      enabledContinousPayment: !enabledContinousPayment
    })
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
}
