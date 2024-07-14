import type { MonetizationEventDetails } from '@/shared/messages'
import type { Tabs } from 'webextension-polyfill'

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

export class TabState {
  private state = new WeakMap<Tabs.Tab, Map<string, State>>()

  constructor() {}

  private getOverpayingStateKey(url: string, walletAddressId: string): string {
    return `${url}:${walletAddressId}`
  }

  getOverpayingWaitTime(
    tab: Tabs.Tab,
    url: string,
    walletAddressId: string
  ): { waitTime: number; monetizationEvent?: MonetizationEventDetails } {
    const key = this.getOverpayingStateKey(url, walletAddressId)
    const state = this.state.get(tab)?.get(key)
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
    tab: Tabs.Tab,
    url: string,
    details: SaveOverpayingDetails
  ): void {
    const { intervalInMs, walletAddressId, monetizationEvent } = details
    if (!intervalInMs) return

    const now = Date.now()
    const expiresAtTimestamp = now + intervalInMs

    const key = this.getOverpayingStateKey(url, walletAddressId)
    const state = this.state.get(tab)?.get(key)

    if (!state) {
      const tabState = this.state.get(tab) || new Map<string, State>()
      tabState.set(key, {
        monetizationEvent,
        expiresAtTimestamp: expiresAtTimestamp,
        lastPaymentTimestamp: now
      })
      this.state.set(tab, tabState)
    } else {
      state.expiresAtTimestamp = expiresAtTimestamp
      state.lastPaymentTimestamp = now
    }
  }
}
