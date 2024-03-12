import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'
import { Label } from '@/popup/components/ui/Label'
import { connected } from 'process'
import React from 'react'
import { Switch } from '@/popup/components/ui/Switch'
import { Code } from '@/popup/components/ui/Code'
import { connectWallet } from '@/popup/lib/messages'
import { getWalletInformation } from '@/shared/helpers'
import { charIsNumber, getCurrencySymbol } from '@/popup/lib/utils'
import { useForm } from 'react-hook-form'
import { numericFormatter } from 'react-number-format'

interface ConnectWalletFormInputs {
  walletAddressUrl: string
  amount: string
  recurring: boolean
}

interface ConnectWalletFormProps {
  publicKey: string
}

export const ConnectWalletForm = ({ publicKey }: ConnectWalletFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    clearErrors,
    setError,
    setValue
  } = useForm<ConnectWalletFormInputs>({
    criteriaMode: 'firstError',
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues: {
      recurring: false
    }
  })
  const [currencySymbol, setCurrencySymbol] = React.useState<{
    symbol: string
    scale: number
  }>({ symbol: '$', scale: 2 })

  const getWalletCurrency = async (walletAddressUrl: string): Promise<void> => {
    clearErrors('walletAddressUrl')
    if (!walletAddressUrl) return
    try {
      const url = new URL(walletAddressUrl)
      const walletAddress = await getWalletInformation(url.toString())
      setCurrencySymbol({
        symbol: getCurrencySymbol(walletAddress.assetCode),
        scale: walletAddress.assetScale
      })
    } catch (e) {
      setError('walletAddressUrl', {
        type: 'validate',
        message: 'Invalid wallet address URL.'
      })
    }
  }

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        const response = await connectWallet(data)
        if (!response.success) {
          setError('walletAddressUrl', {
            type: 'validate',
            message: response.message
          })
        }
      })}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label className="text-base font-medium">Step 1 - Public key</Label>
        <p className="px-2 text-xs">
          Get a wallet address from a provider before connecting it below.
          Please find a list of available wallets{' '}
          <a
            href="https://webmonetization.org/docs/resources/op-wallets/"
            className="text-primary"
            target="_blank"
            rel="noreferrer"
          >
            here
          </a>
          .
          <br /> <br />
          Copy the public key below and paste it into your wallet.
        </p>
        <Code className="text-xs" value={publicKey} />
      </div>
      <Input
        type="url"
        label="Step 2 - Wallet address"
        disabled={connected}
        placeholder="https://ilp.rafiki.money/johndoe"
        errorMessage={errors.walletAddressUrl?.message}
        {...register('walletAddressUrl', {
          required: { value: true, message: 'Wallet address URL is required.' },
          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
            getWalletCurrency(e.currentTarget.value)
          }
        })}
      />
      <Input
        type="text"
        inputMode="numeric"
        disabled={connected}
        addOn={currencySymbol.symbol}
        label="Step 3 - Amount"
        description="Enter the amount to use from your wallet."
        placeholder="5.00"
        onKeyDown={(e) => {
          if (
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
          valueAsNumber: false,
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
                decimalScale: currencySymbol.scale
              })
            )
          }
        })}
      />
      <div className="px-2">
        <Switch {...register('recurring')} label="Renew amount monthly" />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
        loading={isSubmitting}
        aria-label="Connect your wallet"
      >
        Connect
      </Button>
    </form>
  )
}
