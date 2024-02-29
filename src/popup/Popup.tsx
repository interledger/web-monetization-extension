import './Popup.scss'

import React, { useEffect } from 'react'
import browser from 'webextension-polyfill'

// import { RouterProvider } from '@/popup/components/router-provider'
// import { PopupProvider } from '@/popup/providers/popup.provider'
import { Message } from '@/utils/sendMessages'
import { PopupToBackgroundAction, PopupToBackgroundMessage } from '@/utils/types'

const Popup = () => {
  const message = new Message<PopupToBackgroundMessage>(browser)

  useEffect(() => {
    async function test() {
      const response = await message.send({
        action: PopupToBackgroundAction.GET_CONTEXT_DATA,
        payload: undefined,
      })

      console.log(response)
    }
    test()
  })
  return (
    <>test</>
    // <PopupProvider>
    //   <RouterProvider />
    // </PopupProvider>
  )
}

export default Popup
