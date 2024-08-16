import type { MonetizationEventDetails } from '@/shared/messages'
import type { TabId } from '@/shared/types'
import type { PaymentSession } from './paymentSession'
import type { Cradle } from '@/background/container'

type State = {
  monetizationEvent: MonetizationEventDetails
  lastPaymentTimestamp: number
  expiresAtTimestamp: number
}

interface SaveOverpayingDetails {
  walletAddressId: string
  monetizationEvent: MonetizationEventDetails
  intervalInMs: number
}

type SessionId = string

export class TabState {
  private logger: Cradle['logger']

  private state = new Map<TabId, Map<string, State>>()
  private sessions = new Map<TabId, Map<SessionId, PaymentSession>>()

  constructor({ logger }: Cradle) {
    Object.assign(this, {
      logger
    })
  }

  private getOverpayingStateKey(url: string, walletAddressId: string): string {
    return `${url}:${walletAddressId}`
  }

  shouldClearOverpaying(tabId: TabId, url: string): boolean {
    const tabState = this.state.get(tabId)
    if (!tabState?.size || !url) return false
    return ![...tabState.keys()].some((key) => key.startsWith(`${url}:`))
  }

  getOverpayingDetails(
    tabId: TabId,
    url: string,
    walletAddressId: string
  ): { waitTime: number; monetizationEvent?: MonetizationEventDetails } {
    const key = this.getOverpayingStateKey(url, walletAddressId)
    const state = this.state.get(tabId)?.get(key)
    const now = Date.now()

    if (state && state.expiresAtTimestamp > now) {
      return {
        waitTime: state.expiresAtTimestamp - now,
        monetizationEvent: state.monetizationEvent
      }
    }

    return {
      waitTime: 0
    }
  }

  saveOverpaying(
    tabId: TabId,
    url: string,
    details: SaveOverpayingDetails
  ): void {
    const { intervalInMs, walletAddressId, monetizationEvent } = details
    if (!intervalInMs) return

    const now = Date.now()
    const expiresAtTimestamp = now + intervalInMs

    const key = this.getOverpayingStateKey(url, walletAddressId)
    const state = this.state.get(tabId)?.get(key)

    if (!state) {
      const tabState = this.state.get(tabId) || new Map<string, State>()
      tabState.set(key, {
        monetizationEvent,
        expiresAtTimestamp: expiresAtTimestamp,
        lastPaymentTimestamp: now
      })
      this.state.set(tabId, tabState)
    } else {
      state.expiresAtTimestamp = expiresAtTimestamp
      state.lastPaymentTimestamp = now
    }
  }

  getSessions(tabId: TabId) {
    let sessions = this.sessions.get(tabId)
    if (!sessions) {
      sessions = new Map()
      this.sessions.set(tabId, sessions)
    }
    return sessions
  }

  getEnabledSessions(tabId: TabId) {
    return [...this.getSessions(tabId).values()].filter((s) => !s.disabled)
  }

  getPayableSessions(tabId: TabId) {
    return this.getEnabledSessions(tabId).filter((s) => !s.invalid)
  }

  isTabMonetized(tabId: TabId) {
    return this.getEnabledSessions(tabId).length > 0
  }

  tabHasAllSessionsInvalid(tabId: TabId) {
    const sessions = this.getEnabledSessions(tabId)
    return sessions.length > 0 && sessions.every((s) => s.invalid)
  }

  getAllSessions() {
    return [...this.sessions.values()].flatMap((s) => [...s.values()])
  }

  getAllTabs(): TabId[] {
    return [...this.sessions.keys()]
  }

  clearOverpayingByTabId(tabId: TabId) {
    this.state.delete(tabId)
    this.logger.debug(`Cleared overpaying state for tab ${tabId}.`)
  }

  clearSessionsByTabId(tabId: TabId) {
    const sessions = this.getSessions(tabId)
    if (!sessions.size) return

    for (const session of sessions.values()) {
      session.stop()
    }
    this.logger.debug(`Cleared ${sessions.size} sessions for tab ${tabId}.`)
    this.sessions.delete(tabId)
  }
}
