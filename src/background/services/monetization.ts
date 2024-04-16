// TO DO
import { OpenPaymentsService, StorageService } from '.'
import { Runtime } from 'webextension-polyfill'
import { Logger } from '@/shared/logger'
import {
  StartMonetizationPayload,
  StopMonetizationPayload
} from '@/shared/messages'
import { PaymentSession } from './paymentSession'

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

  clearTabSession(tabId: number) {
    const sessions = this.sessions[tabId]

    if (!sessions) return

    for (const session of sessions.values()) {
      session.stop()
    }

    delete this.sessions[tabId]
  }

  async startPaymentSession(
    payload: StartMonetizationPayload,
    sender: Runtime.MessageSender
  ) {
    const { requestId, walletAddress } = payload
    const tabId = sender.tab?.id
    const frameId = sender.frameId

    if (tabId == null) {
      this.logger.debug('Tab ID is missing.')
      return
    }

    if (frameId == null) {
      this.logger.debug('Frame ID is missing.')
      return
    }

    if (this.sessions[tabId] == null) {
      this.sessions[tabId] = new Map()
    }

    this.logger.debug({ tabId, frameId, payload })

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

  async toggleWM() {
    const { enabled } = await this.storage.get(['enabled'])
    await this.storage.set({ enabled: !enabled })
  }

  stopPaymentSession(
    payload: StopMonetizationPayload,
    sender: Runtime.MessageSender
  ) {
    const { requestId } = payload
    const tabId = sender.tab?.id
    const frameId = sender.frameId

    if (tabId == null) {
      this.logger.debug('Tab ID is missing.')
      return
    }

    if (frameId == null) {
      this.logger.debug('Frame ID is missing.')
      return
    }

    this.sessions[tabId].get(requestId)?.stop()
  }
}
