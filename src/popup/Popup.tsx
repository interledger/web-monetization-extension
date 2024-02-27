import './Popup.scss'

import React from 'react'

import { RouterProvider } from '@/popup/components/router-provider'
import { PopupProvider } from '@/popup/providers/popup.provider'

const Popup = () => {
  return (
    <PopupProvider>
      <RouterProvider />
    </PopupProvider>
  )
}

export default Popup
