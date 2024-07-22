import React from 'react'
import { useLocation } from 'react-router-dom'
import { AddFunds } from '@/popup/components/OutOfFunds'
import { usePopupState } from '@/popup/lib/context'
import { addFunds } from '@/popup/lib/messages'

export type State = { recurring: boolean }

export const Component = () => {
  const {
    state: { grants, walletAddress }
  } = usePopupState()
  const location = useLocation()
  const state = location.state as State

  return (
    <AddFunds
      info={walletAddress}
      grantOneTime={grants.oneTime}
      grantRecurring={grants.recurring}
      recurring={state.recurring}
      requestAddFunds={async (data) => {
        const res = await addFunds(data)
        return res
      }}
    />
  )
}
