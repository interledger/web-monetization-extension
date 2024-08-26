import React from 'react'
import { useNavigate } from 'react-router-dom'
import { OutOfFunds } from '@/popup/components/OutOfFunds'
import { usePopupState } from '@/popup/lib/context'
import { ROUTES_PATH } from '@/popup/Popup'
import type { State } from '@/popup/pages/OutOfFunds_AddFunds'

export const Component = () => {
  const {
    state: { grants, walletAddress },
  } = usePopupState()
  const navigate = useNavigate()

  return (
    <OutOfFunds
      info={walletAddress}
      grantOneTime={grants.oneTime}
      grantRecurring={grants.recurring}
      onChooseOption={(recurring) => {
        const state: State = { recurring }
        navigate(ROUTES_PATH.OUT_OF_FUNDS_ADD_FUNDS, { state })
      }}
    />
  )
}
