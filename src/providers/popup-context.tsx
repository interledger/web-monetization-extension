import React, { createContext, useEffect, useState } from 'react'

import { sendMessage } from '@/utils/sendMessages'

import { PopupContextValue, TPopupContext } from './providers.interface'

export const defaultData = {
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

  const getStorageData = async () => await sendMessage({ type: 'GET_STORAGE_DATA' })

  useEffect(() => {
    ;(async () => {
      const storageData = await getStorageData()
      console.log('storageData xxx', storageData)
      // setData(storageData.data)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <PopupContext.Provider value={{ data, setData }}>{children}</PopupContext.Provider>
}

export default PopupProvider
