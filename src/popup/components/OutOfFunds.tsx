import React from 'react'
import { Button } from './ui/Button'
import type { RecurringGrant, OneTimeGrant, AmountValue } from '@/shared/types'
import type { AddFundsPayload, Response } from '@/shared/messages'
import type { WalletAddress } from '@interledger/open-payments'
import {
  charIsNumber,
  formatNumber,
  getCurrencySymbol,
  transformBalance
} from '../lib/utils'
import { getNextOccurrence } from '@/shared/helpers'
import { ErrorMessage } from './ErrorMessage'
import { Input } from './ui/Input'
import { useForm } from 'react-hook-form'

interface OutOfFundsProps {
  info: Pick<WalletAddress, 'id' | 'assetCode' | 'assetScale'>
  grantRecurring?: RecurringGrant['amount']
  grantOneTime?: OneTimeGrant['amount']
  onChooseOption: (recurring: boolean) => void
}

export const OutOfFunds = ({
  info,
  grantOneTime,
  grantRecurring,
  onChooseOption
}: OutOfFundsProps) => {
  if (!grantOneTime && !grantRecurring) {
    throw new Error('Provide at least one of grantOneTime and grantRecurring')
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorMessage error="Out of funds" className="mb-0 text-error" />
      <div className="px-2 text-xs text-medium">
        <p>Funds have been depleted. You can no longer make payments.</p>
        <p>Please add funds.</p>
        {grantRecurring?.value && (
          <p className="mt-1">
            <RecurringAutoRenewInfo
              info={info}
              grantRecurring={grantRecurring}
            />
          </p>
        )}
      </div>

      <div className="w-100 h-0.5 bg-disabled" />

      <Button onClick={() => onChooseOption(true)}>Recurring</Button>
      <Button onClick={() => onChooseOption(false)}>One-time</Button>
    </div>
  )
}

interface AddFundsProps {
  info: Pick<WalletAddress, 'id' | 'assetCode' | 'assetScale'>
  recurring: false | 'P1M'
  defaultAmount: AmountValue
  requestAddFunds: (details: AddFundsPayload) => Promise<Response>
}

export function AddFunds({
  info,
  defaultAmount,
  recurring,
  requestAddFunds
}: AddFundsProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue
  } = useForm({
    criteriaMode: 'firstError',
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues: {
      amount: transformBalance(defaultAmount, info.assetScale)
    }
  })

  const currencySymbol = getCurrencySymbol(info.assetCode)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(async (data) => {
        const response = await requestAddFunds({
          amount: data.amount,
          recurring: !!recurring
        })
        if (!response.success) {
          setError('root', { message: response.message })
        }
      })}
    >
      <Input
        type="url"
        label="Connected wallet address"
        value={info.id}
        readOnly
        disabled
      />

      <Input
        type="text"
        inputMode="numeric"
        addOn={currencySymbol}
        label="Amount"
        description={
          'Enter the amount to add from the wallet.' +
          (recurring
            ? ' ' +
              `This amount will renew automatically every month (next: ${getNextOccurrence(`R/${new Date().toISOString()}/P1M`).toLocaleDateString(undefined, { dateStyle: 'medium' })}).`
            : '')
        }
        placeholder="5.00"
        onKeyDown={(e) => {
          if (
            !charIsNumber(e.key) &&
            e.key !== 'Backspace' &&
            e.key !== 'ArrowLeft' &&
            e.key !== 'ArrowRight' &&
            e.key !== 'Delete' &&
            e.key !== 'Tab'
          ) {
            e.preventDefault()
          }
        }}
        errorMessage={errors.amount?.message}
        {...register('amount', {
          required: { value: true, message: 'Amount is required.' },
          valueAsNumber: false,
          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
            setValue(
              'amount',
              formatNumber(+e.currentTarget.value, info.assetScale)
            )
          }
        })}
      />

      {(errors.root || errors.amount) && (
        <ErrorMessage
          error={errors.root?.message || errors.amount?.message}
          className="mb-0 py-1 text-xs text-error"
        />
      )}

      <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
        Add funds
      </Button>
    </form>
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
    <>
      If you do nothing, {currencySymbol}
      {amount} will automatically be available on{' '}
      <time dateTime={renewDate.toISOString()} title={renewDate.toISOString()}>
        {renewDate.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short'
        })}
      </time>
    </>
  )
}
