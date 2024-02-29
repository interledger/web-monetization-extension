import { type WalletAddress } from '@interledger/open-payments/dist/types'
import React from 'react'

import { Amount } from '@/utils/types'

export interface PopupContextValue {
  data: TPopupContext
  setData: React.Dispatch<React.SetStateAction<TPopupContext>>
}

export type TPopupContext = {
  // is connected wallet general
  connected: boolean
  // user waller address
  walletAddress?: WalletAddress
  // general amount
  amount?: Amount
  // wm general enabled
  enabled: boolean
  // specific amount for website
  websiteAmount: Amount

  publicKey: string
}
