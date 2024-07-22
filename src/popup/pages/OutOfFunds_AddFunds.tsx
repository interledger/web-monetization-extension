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

  const state: State = { recurring: false, ...location.state }
  const defaultAmount = grants.recurring?.value ?? grants.oneTime!.value

  return (
    <AddFunds
      info={walletAddress}
      defaultAmount={defaultAmount}
      recurring={state.recurring ? 'P1M' : false}
      requestAddFunds={async (data) => {
        const res = await addFunds(data)
        return res
      }}
    />
  )
}
