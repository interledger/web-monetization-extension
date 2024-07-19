import React from 'react'
import { OutOfFunds } from '@/popup/components/OutOfFunds'
import { usePopupState } from '@/popup/lib/context'
import { addFunds } from '@/popup/lib/messages'

export const Component = () => {
  const {
    state: { grants, walletAddress }
  } = usePopupState()

  return (
    <OutOfFunds
      info={walletAddress}
      grantOneTime={grants.oneTime}
      grantRecurring={grants.recurring}
      requestAddFunds={async (data) => {
        const res = await addFunds(data)
        return res
      }}
    />
  )
}
