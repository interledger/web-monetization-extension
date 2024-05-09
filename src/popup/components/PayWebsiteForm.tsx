import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'
import { PopupStateContext } from '@/popup/lib/context'
import { payWebsite } from '@/popup/lib/messages'
import { getCurrencySymbol, charIsNumber } from '@/popup/lib/utils'
import React, { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { numericFormatter } from 'react-number-format'
import { AnimatePresence, m } from 'framer-motion'
import { Spinner } from './Icons'
import { cn } from '@/shared/helpers'

interface PayWebsiteFormProps {
  amount: string
}

const BUTTON_STATE = {
  idle: 'Send now',
  loading: <Spinner className="w-6 animate-spin" />,
  success: 'Payment successful'
}

export const PayWebsiteForm = () => {
  const [buttonState, setButtonState] =
    React.useState<keyof typeof BUTTON_STATE>('idle')
  const isIdle = useMemo(() => {
    return buttonState === 'idle'
  }, [buttonState])
  const {
    state: { walletAddress, url }
  } = React.useContext(PopupStateContext)
  const {
    register,
    formState: { errors, isSubmitting },
    setValue,
    handleSubmit,
    ...form
  } = useForm<PayWebsiteFormProps>()

  const onSubmit = handleSubmit(async (data) => {
    if (buttonState !== 'idle') return

    setButtonState('loading')

    const response = await payWebsite(data)

    if (!response.success) {
      setButtonState('idle')
      form.setError('root', { message: response.message })
    } else {
      setButtonState('success')
      form.reset()
      setTimeout(() => {
        setButtonState('idle')
      }, 2000)
    }
  })

  return (
    <form onSubmit={onSubmit}>
      <Input
        type="text"
        inputMode="numeric"
        addOn={getCurrencySymbol(walletAddress.assetCode)}
        label={
          <p className="mb-4 overflow-hidden text-ellipsis whitespace-nowrap">
            Pay <span className="text-ellipsis text-primary">{url}</span>
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
      {errors.root ? (
        <m.p className="m-2 mr-0 text-red-500">{errors.root.message}</m.p>
      ) : null}
      <Button
        type="submit"
        className={cn(
          'mt-8 w-full',
          !isIdle ? 'cursor-not-allowed' : null,
          !isIdle && !isSubmitting ? 'disabled:opacity-100' : null
        )}
        disabled={isSubmitting || !isIdle}
        aria-label="Send now"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 25 }}
            key={buttonState}
          >
            {BUTTON_STATE[buttonState]}
          </m.span>
        </AnimatePresence>
      </Button>
    </form>
  )
}
