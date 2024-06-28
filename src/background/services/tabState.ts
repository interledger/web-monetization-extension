import { getHash } from '../utils'

import { Tabs } from 'webextension-polyfill'
import { sleep } from '@/shared/helpers'
import { WalletAddress } from '@interledger/open-payments'

type State = {
  lastPaymentTimestamp: number
  expireTimestamp: number
}

export class TabState {
  private states = new WeakMap<Tabs.Tab, { [key: string]: State }>()

  constructor() {}

  private async getStateKey(
    url: string,
    walletAddress: WalletAddress
  ): Promise<string> {
    const hashUrl = await getHash(url)
    const hashWalletAddress = await getHash(JSON.stringify(walletAddress))
    const stateKey = `${hashUrl}:${hashWalletAddress}`

    return stateKey
  }

  async processOverpaying(
    tab: Tabs.Tab,
    url: string,
    walletAddress: WalletAddress
  ): Promise<void> {
    const stateKey = await this.getStateKey(url, walletAddress)
    const state = this.states.get(tab)?.[stateKey]

    if (state) {
      // If session not expired yet, wait until it expires
      const crtTimestamp = Date.now()
      if (state.expireTimestamp > crtTimestamp) {
        await sleep(state.expireTimestamp - crtTimestamp)
      }
    }
  }

  async saveOverpaying(
    tab: Tabs.Tab,
    url: string,
    walletAddress: WalletAddress,
    intervalInMs: number
  ): Promise<void> {
    if (!intervalInMs) return

    const stateKey = await this.getStateKey(url, walletAddress)
    const state = this.states.get(tab)?.[stateKey]

    const crtTimestamp = Date.now()
    const expireTimestamp = crtTimestamp + intervalInMs

    if (state) {
      state.expireTimestamp = expireTimestamp
      state.lastPaymentTimestamp = crtTimestamp
    }
  }
}
