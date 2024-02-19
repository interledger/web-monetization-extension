import React, { createContext, useState } from 'react'

import { PopupContextValue, TPopupContext } from './providers.interface'

export const defaultData = {
  connected: false,
  wallet: '',
  amount: 0,
  amountType: {
    recurring: true,
  },
  rateOfPay: 0.36,
  wmEnabled: true,
  accessTokenQuote: '',
  accessTokenOutgoing: '',
  refreshToken: '',
  manageUrl: '',
}

interface IProps {
  children: React.ReactNode
}

export const PopupContext = createContext<PopupContextValue>({
  data: defaultData,
  setData: () => {},
})

export const PopupProvider: React.FC<IProps> = ({ children }) => {
  const [data, setData] = useState<TPopupContext>(defaultData)

  return <PopupContext.Provider value={{ data, setData }}>{children}</PopupContext.Provider>
}

export default PopupProvider
