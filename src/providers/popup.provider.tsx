import React, { createContext, useEffect, useState } from 'react'

import { getStorageData } from '@/utils/storage'

import { PopupContextValue, TPopupContext } from './providers.interface'
import setStorageData from '../messageHandlers/setStorageData'
import { sendMessage } from '@/utils/sendMessages'

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

  useEffect(() => {
    ;(async () => {
      const storageData = await getStorageData()
      setData(storageData as TPopupContext)
    })()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!data) return

    sendMessage({ type: 'SET_STORAGE_DATA', data })
  }, [data])

  return <PopupContext.Provider value={{ data, setData }}>{children}</PopupContext.Provider>
}

export default PopupProvider
