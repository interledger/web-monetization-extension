import React, { createContext, useEffect, useState } from 'react'

import { sendMessage } from '@/utils/sendMessages'
import { defaultData, getStorageData } from '@/utils/storage'

import { PopupContextValue, TPopupContext } from './providers.interface'

interface IProps {
  children: React.ReactNode
}

export const PopupContext = createContext<PopupContextValue>({
  data: { ...defaultData },
  setData: () => {},
})

export const PopupProvider: React.FC<IProps> = ({ children }) => {
  const [data, setData] = useState<TPopupContext>({ ...defaultData })

  const updateStorageData = async () => {
    await sendMessage({ type: 'SET_STORAGE_DATA', data })
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const storageData = await getStorageData()
        if (storageData) {
          setData(prevState => ({ ...prevState, ...storageData }))
        }
      } catch (error) {
        console.error('Error fetching storage data:', error)
        setData(defaultData)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (JSON.stringify(data) !== JSON.stringify(defaultData)) {
      updateStorageData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return <PopupContext.Provider value={{ data, setData }}>{children}</PopupContext.Provider>
}

export default PopupProvider
