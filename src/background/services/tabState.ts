import { Tabs } from 'webextension-polyfill'

type State = {
  lastPaymentTimestamp: number
  expiresAtTimestamp: number
}

export class TabState {
  private state = new WeakMap<Tabs.Tab, Map<string, State>>()

  constructor() {}

  private getStateKey(url: string, walletAddressId: string): string {
    return `${url}:${walletAddressId}`
  }

  async getOverpayingWaitTime(
    tab: Tabs.Tab,
    url: string,
    walletAddressId: string
  ): Promise<number> {
    const key = this.getStateKey(url, walletAddressId)
    const state = this.state.get(tab)?.get(key)
    const now = Date.now()

    if (state && state.expiresAtTimestamp > now) {
      return state.expiresAtTimestamp - now
    }

    return 0
  }

  async saveOverpaying(
    tab: Tabs.Tab,
    url: string,
    walletAddressId: string,
    intervalInMs: number
  ): Promise<void> {
    if (!intervalInMs) return

    const crtTimestamp = Date.now()
    const expiresAtTimestamp = crtTimestamp + intervalInMs

    const key = this.getStateKey(url, walletAddressId)
    const state = this.state.get(tab)?.get(key) || {
      expiresAtTimestamp: expiresAtTimestamp,
      lastPaymentTimestamp: crtTimestamp
    }

    if (!state) {
      const tabState = this.state.get(tab) || new Map()
      tabState.set(key, state)

      this.state.set(tab, tabState)
    }

    if (state) {
      state.expiresAtTimestamp = expiresAtTimestamp
      state.lastPaymentTimestamp = crtTimestamp
    }
  }
}
