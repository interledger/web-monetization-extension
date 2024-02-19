import React, { createContext, useEffect, useState } from 'react'

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

  return <PopupContext.Provider value={{ data, setData }}>{children}</PopupContext.Provider>
}

export default PopupProvider
