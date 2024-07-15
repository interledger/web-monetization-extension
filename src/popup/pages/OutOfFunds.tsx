import React from 'react'
import { OutOfFunds } from '@/popup/components/OutOfFunds'
import { usePopupState } from '@/popup/lib/context'
import { connectWallet } from '@/popup/lib/messages'

export const Component = () => {
  const {
    state: { grants, walletAddress }
  } = usePopupState()

  return (
    <OutOfFunds
      info={walletAddress}
      grantOneTime={grants.oneTime}
      grantRecurring={grants.recurring}
      requestTopUp={async (data) => {
        const res = await connectWallet(data)
        return res
      }}
    />
  )
}
