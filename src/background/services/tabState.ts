import type { MonetizationEventDetails } from '@/shared/messages'
import { Tabs } from 'webextension-polyfill'

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

type TabId = NonNullable<Tabs.Tab['id']>
type SessionId = string

export class TabState {
  private state = new Map<TabId, Map<SessionId, State>>()

  constructor() {}

  private getOverpayingStateKey(url: string, walletAddressId: string): string {
    return `${url}:${walletAddressId}`
  }

  getOverpayingDetails(
    tabId: number,
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
    tabId: number,
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

  clearByTabId(tabId: number) {
    this.state.delete(tabId)
  }
}
