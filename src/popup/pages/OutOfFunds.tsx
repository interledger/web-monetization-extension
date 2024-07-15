import React from 'react'
import { OutOfFunds } from '@/popup/components/OutOfFunds'
import { usePopupState } from '@/popup/lib/context'
import { sleep } from '@/shared/helpers'

export const Component = () => {
  const {
    state: { grants, walletAddress }
  } = usePopupState()

  return (
    <OutOfFunds
      info={walletAddress}
      grantOneTime={grants.oneTime}
      grantRecurring={grants.recurring}
      requestTopUp={async (...args) => {
        console.log(...args)
        await sleep(2000)
        return { success: true, payload: undefined }
      }}
    />
  )
}
