import React from 'react'
import { useForm } from 'react-hook-form'
import type { RecurringGrant, OneTimeGrant, AmountValue } from '@/shared/types'
import type { AddFundsPayload, Response } from '@/shared/messages'
import type { WalletAddress } from '@interledger/open-payments'
import {
  charIsNumber,
  formatNumber,
  getCurrencySymbol,
  transformBalance
} from '@/popup/lib/utils'
import { useTranslation } from '@/popup/lib/context'
import { getNextOccurrence } from '@/shared/helpers'
import { ErrorMessage } from '@/popup/components/ErrorMessage'
import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'

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
  const t = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <ErrorMessage
        error={t('outOfFunds_error_title')}
        className="mb-0 text-error"
      />
      <div className="px-2 text-xs text-medium">
        <p>{t('outOfFunds_error_text')}</p>
        <p>{t('outOfFunds_error_textHint')}</p>
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

      <Button onClick={() => onChooseOption(true)}>
        {t('outOfFunds_action_optionRecurring')}
      </Button>
      <Button onClick={() => onChooseOption(false)}>
        {t('outOfFunds_action_optionOneTime')}
      </Button>
    </div>
  )
}

interface AddFundsProps {
  info: Pick<WalletAddress, 'id' | 'assetCode' | 'assetScale'>
  recurring: boolean
  defaultAmount: AmountValue
  requestAddFunds: (details: AddFundsPayload) => Promise<Response>
}

export function AddFunds({
  info,
  defaultAmount,
  recurring,
  requestAddFunds
}: AddFundsProps) {
  const t = useTranslation()
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
        label={t('outOfFundsAddFunds_label_walletAddress')}
        value={info.id}
        readOnly
        disabled
      />

      <Input
        type="text"
        inputMode="numeric"
        addOn={currencySymbol}
        label={t('outOfFundsAddFunds_label_amount')}
        description={
          recurring
            ? t('outOfFundsAddFunds_label_amountDescriptionRecurring', [
                getNextOccurrenceDate('P1M')
              ])
            : t('outOfFundsAddFunds_label_amountDescriptionOneTime')
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
            setValue('amount', formatNumber(+e.currentTarget.value, 2))
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
        {recurring
          ? t('outOfFundsAddFunds_action_addRecurring')
          : t('outOfFundsAddFunds_action_addOneTime')}
      </Button>
    </form>
  )
}

function RecurringAutoRenewInfo({
  grantRecurring,
  info
}: Pick<OutOfFundsProps, 'grantRecurring' | 'info'>) {
  const t = useTranslation()

  if (!grantRecurring) return null

  const currencySymbol = getCurrencySymbol(info.assetCode)
  const amount = transformBalance(grantRecurring.value, info.assetScale)
  const renewDate = getNextOccurrence(grantRecurring.interval, new Date())
  const renewDateLocalized = renewDate.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  return t('outOfFunds_error_textDoNothing', [
    `${currencySymbol}${amount}`,
    renewDateLocalized
  ])
}

function getNextOccurrenceDate(period: 'P1M', baseDate = new Date()) {
  const date = getNextOccurrence(
    `R/${baseDate.toISOString()}/${period}`,
    baseDate
  )
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}
