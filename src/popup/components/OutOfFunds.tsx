import React from 'react'
import { Button } from './ui/Button'
import type { RecurringGrant, OneTimeGrant } from '@/shared/types'
import type { AddFundsPayload, Response } from '@/shared/messages'
import type { WalletAddress } from '@interledger/open-payments'
import { getCurrencySymbol, transformBalance } from '../lib/utils'
import { getNextOccurrence } from '@/shared/helpers'

interface OutOfFundsProps {
  info: Pick<WalletAddress, 'id' | 'assetCode' | 'assetScale'>
  grantRecurring?: RecurringGrant['amount']
  grantOneTime?: OneTimeGrant['amount']
  requestAddFunds: (details: AddFundsPayload) => Promise<Response>
}

export const OutOfFunds = ({
  info,
  grantOneTime,
  grantRecurring,
  requestAddFunds
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
    return requestAddFunds({ amount: amount, recurring: false })
  }

  const requestTopUpRecurring = () => {
    return requestAddFunds({ amount: amount, recurring: true })
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl">Out of funds</h2>

      <h3 className="text-lg">
        Top-up: <span>{currencySymbol + amount}</span>
      </h3>
      <RecurringAutoRenewInfo grantRecurring={grantRecurring} info={info} />
      <Button onClick={() => requestTopUpRecurring()}>Recurring</Button>
      <Button onClick={() => requestTopUpOneTime()}>One-time</Button>
    </div>
  )
}

function RecurringAutoRenewInfo({
  grantRecurring,
  info
}: Pick<OutOfFundsProps, 'grantRecurring' | 'info'>) {
  if (!grantRecurring) return null

  const currencySymbol = getCurrencySymbol(info.assetCode)
  const amount = transformBalance(grantRecurring.value, info.assetScale)
  const renewDate = getNextOccurrence(grantRecurring.interval, new Date())

  return (
    <p>
      If you do nothing, you will have {currencySymbol}
      {amount} available on{' '}
      <time dateTime={renewDate.toISOString()}>
        {renewDate.toLocaleString(undefined, {
          dateStyle: 'long',
          timeStyle: 'medium'
        })}
      </time>
    </p>
  )
}
