import { PopupContextProvider, PopupStateContext } from '@/popup/lib/context'
import './Popup.scss'

import React, { useContext } from 'react'

// import { RouterProvider } from '@/popup/components/router-provider'
// import { PopupProvider } from '@/popup/providers/popup.provider'

const Popup = () => {
  return (
    <PopupContextProvider>
      <Test />
    </PopupContextProvider>

    // <PopupProvider>
    //   <RouterProvider />
    // </PopupProvider>
  )
}

const Test = () => {
  const { state } = useContext(PopupStateContext)
  console.log('state', state)
  return <>testtt</>
}

export default Popup
