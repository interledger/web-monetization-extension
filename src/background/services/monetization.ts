import { OpenPaymentsService, StorageService } from '.'
import { Runtime } from 'webextension-polyfill'
import { Logger } from '@/shared/logger'
import {
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload
} from '@/shared/messages'
import { PaymentSession } from './paymentSession'
import { getSender, getTabId } from '../utils'

export class MonetizationService {
  private sessions: {
    [tabId: number]: Map<string, PaymentSession>
  }

  constructor(
    private logger: Logger,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService
  ) {
    this.sessions = {}
  }

  async startPaymentSession(
    payload: StartMonetizationPayload,
    sender: Runtime.MessageSender
  ) {
    // TODO: This is not ideal. We should not receive monetization events
    // from the content script if WM is disabled or a wallet is not connected.
    const { connected, enabled } = await this.storage.get([
      'enabled',
      'connected'
    ])
    if (connected === false || enabled === false) return

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
    void session.start()
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
}
