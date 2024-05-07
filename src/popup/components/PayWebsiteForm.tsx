import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'
import { PopupStateContext } from '@/popup/lib/context'
import { payWebsite } from '@/popup/lib/messages'
import { getCurrencySymbol, charIsNumber } from '@/popup/lib/utils'
import React from 'react'
import { useForm } from 'react-hook-form'
import { numericFormatter } from 'react-number-format'

interface PayWebsiteFormProps {
  amount: string
}

export const PayWebsiteForm = () => {
  const {
    state: { walletAddress, url }
  } = React.useContext(PopupStateContext)
  const {
    register,
    formState: { errors, isSubmitting },
    setValue,
    handleSubmit
  } = useForm<PayWebsiteFormProps>()

  const onSubmit = handleSubmit(async (data) => {
    await payWebsite(data)
  })

  return (
    <form onSubmit={onSubmit}>
      <Input
        type="text"
        inputMode="numeric"
        addOn={getCurrencySymbol(walletAddress.assetCode)}
        label={
          <p className="mb-4">
            Pay <span className="text-wrap break-all text-primary">{url}</span>
          </p>
        }
        placeholder="0.00"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
            onSubmit()
          } else if (
            !charIsNumber(e.key) &&
            e.key !== 'Backspace' &&
            e.key !== 'Delete' &&
            e.key !== 'Tab'
          ) {
            e.preventDefault()
          }
        }}
        errorMessage={errors.amount?.message}
        {...register('amount', {
          required: { value: true, message: 'Amount is required.' },
          valueAsNumber: true,
          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
            setValue(
              'amount',
              numericFormatter(e.currentTarget.value, {
                allowNegative: false,
                valueIsNumericString: true,
                allowLeadingZeros: false,
                decimalSeparator: '.',
                thousandSeparator: ',',
                thousandsGroupStyle: 'thousand',
                fixedDecimalScale: true,
                decimalScale: walletAddress.assetScale
              })
            )
          }
        })}
      />
      <Button
        type="submit"
        className="mt-8 w-full"
        disabled={isSubmitting}
        loading={isSubmitting}
        aria-label="Connect your wallet"
      >
        Send now
      </Button>
    </form>
  )
}
