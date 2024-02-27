import { useContext } from 'react'

import { PopupContext } from './popup.provider'

export const usePopup = () => {
  const context = useContext(PopupContext)
  if (context === undefined) {
    throw new Error('usePopup must be used with a PopupContext')
  }
  return context
}
