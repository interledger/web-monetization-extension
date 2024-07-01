import { getHash } from '../utils'

import { Tabs } from 'webextension-polyfill'
import { WalletAddress } from '@interledger/open-payments'

type State = {
  lastPaymentTimestamp: number
  expiresAtTimestamp: number
}

export class TabState {
  private state = new WeakMap<Tabs.Tab, { [key: string]: State }>()

  constructor() {}

  private async getStateKey(
    url: string,
    walletAddress: WalletAddress
  ): Promise<string> {
    const hashUrl = await getHash(url)
    const hashWalletAddress = await getHash(JSON.stringify(walletAddress))
    const key = `${hashUrl}:${hashWalletAddress}`

    return key
  }

  async getOverpayingWaitTime(
    tab: Tabs.Tab,
    url: string,
    walletAddress: WalletAddress
  ): Promise<number | undefined> {
    const key = await this.getStateKey(url, walletAddress)
    const state = this.state.get(tab)?.[key]
    const now = Date.now()

    if (state && state.expiresAtTimestamp > now) {
      return state.expiresAtTimestamp - now
    }
    
    return
  }

  async saveOverpaying(
    tab: Tabs.Tab,
    url: string,
    walletAddress: WalletAddress,
    intervalInMs: number
  ): Promise<void> {
    if (!intervalInMs) return

    const key = await this.getStateKey(url, walletAddress)
    const state = this.state.get(tab)?.[key]

    const crtTimestamp = Date.now()
    const expiresAtTimestamp = crtTimestamp + intervalInMs

    if (state) {
      state.expiresAtTimestamp = expiresAtTimestamp
      state.lastPaymentTimestamp = crtTimestamp
    }
  }
}
