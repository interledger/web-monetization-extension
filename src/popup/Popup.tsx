import './Popup.scss'

import React from 'react'

import { RouterProvider } from '@/components/router-provider'
import { PopupProvider } from '@/providers/popup.provider'

const Popup = () => {
  return (
    <PopupProvider>
      <RouterProvider />
    </PopupProvider>
  )
}

export default Popup
