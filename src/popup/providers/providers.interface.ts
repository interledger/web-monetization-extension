import React from 'react'

export interface PopupContextValue {
  data: TPopupContext
  setData: React.Dispatch<React.SetStateAction<TPopupContext>>
}

export type TPopupContext = {
  connected: boolean
  wallet: string
  amount: number
  amountType: {
    recurring: boolean
  }
  rateOfPay: number
  wmEnabled: boolean
  accessTokenQuote: string
  accessTokenOutgoing: string
  refreshToken: string
  manageUrl: string
}
