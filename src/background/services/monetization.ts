// TO DO
import { OpenPaymentsService, StorageService } from '.'
import { Runtime, type Browser } from 'webextension-polyfill'
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
    private browser: Browser,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService
  ) {
    this.sessions = {}
  }

  stopMonetization(
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

    const session = new PaymentSession(
      walletAddress,
      requestId,
      tabId,
      frameId,
      '60',
      this.openPaymentsService,
      this.storage
    )
    this.sessions[tabId].set(requestId, session)
    this.storage.test()
    void session.start()
  }

  async toggleWM() {
    const { enabled } = await this.storage.get(['enabled'])
    await this.storage.set({ enabled: !enabled })
  }
}
