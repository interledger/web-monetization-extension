import React from 'react'
import { Button } from './ui/Button'
import type { RecurringGrant, OneTimeGrant } from '@/shared/types'
import type { ConnectWalletPayload, Response } from '@/shared/messages'
import type { WalletAddress } from '@interledger/open-payments'
import { getCurrencySymbol, transformBalance } from '../lib/utils'

interface OutOfFundsProps {
  info: Pick<WalletAddress, 'id' | 'assetCode' | 'assetScale'>
  grantRecurring?: RecurringGrant['amount']
  grantOneTime?: OneTimeGrant['amount']
  requestTopUp: (details: ConnectWalletPayload) => Promise<Response>
}

export const OutOfFunds = ({
  info,
  grantOneTime,
  grantRecurring,
  requestTopUp
}: OutOfFundsProps) => {
  if (!grantOneTime && !grantRecurring) {
    throw new Error('Provide at least one of grantOneTime and grantRecurring')
  }

  const currencySymbol = getCurrencySymbol(info.assetCode)
  const amount = transformBalance(
    grantRecurring?.value || grantOneTime!.value,
    info.assetScale
  )

  const requestTopUpOneTime = () => {
    return requestTopUp({
      walletAddressUrl: info.id,
      amount: amount,
      recurring: false
    })
  }

  const requestTopUpRecurring = () => {
    return requestTopUp({
      walletAddressUrl: info.id,
      amount: amount,
      recurring: true
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl">Out of funds</h2>

      <h3 className="text-lg">
        Top-up: <span>{currencySymbol + amount}</span>
      </h3>
      <Button onClick={() => requestTopUpRecurring()}>Recurring</Button>
      <Button onClick={() => requestTopUpOneTime()}>One-time</Button>
    </div>
  )
}
