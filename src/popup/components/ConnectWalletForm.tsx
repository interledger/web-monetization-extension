import React, { useCallback, useEffect } from 'react'
import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'
import { Label } from '@/popup/components/ui/Label'
import { Switch } from '@/popup/components/ui/Switch'
import { Code } from '@/popup/components/ui/Code'
import { debounceSync, getWalletInformation } from '@/shared/helpers'
import {
  charIsNumber,
  formatNumber,
  getCurrencySymbol,
  toWalletAddressUrl
} from '@/popup/lib/utils'
import { useForm } from 'react-hook-form'
import { useMessage } from '@/popup/lib/context'

interface ConnectWalletFormInputs {
  walletAddressUrl: string
  amount: string
  recurring: boolean
}

interface ConnectWalletFormProps {
  publicKey: string
}

export const ConnectWalletForm = ({ publicKey }: ConnectWalletFormProps) => {
  const message = useMessage()
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
      recurring: localStorage?.getItem('recurring') === 'true' || false,
      amount: localStorage?.getItem('amountValue') || undefined,
      walletAddressUrl: localStorage?.getItem('walletAddressUrl') || undefined
    }
  })
  const [currencySymbol, setCurrencySymbol] = React.useState<{
    symbol: string
    scale: number
  }>({ symbol: '$', scale: 2 })

  const getWalletCurrency = useCallback(
    async (walletAddressUrl: string): Promise<void> => {
      clearErrors('walletAddressUrl')
      if (!walletAddressUrl) return
      try {
        const url = new URL(toWalletAddressUrl(walletAddressUrl))
        const walletAddress = await getWalletInformation(url.toString())
        setCurrencySymbol({
          symbol: getCurrencySymbol(walletAddress.assetCode),
          scale: walletAddress.assetScale
        })
      } catch {
        setError('walletAddressUrl', {
          type: 'validate',
          message: 'Invalid wallet address.'
        })
      }
    },
    [clearErrors, setError]
  )

  const handleOnChangeAmount = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const amountValue = formatNumber(
      +e.currentTarget.value,
      currencySymbol.scale
    )
    debounceSync(() => {
      localStorage?.setItem('amountValue', amountValue)
    }, 100)()
  }

  const handleOnChangeWalletAddressUrl = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const walletAddressUrl = e.currentTarget.value
    debounceSync(() => {
      localStorage?.setItem('walletAddressUrl', walletAddressUrl)
    }, 100)()
  }

  const handleOnChangeRecurring = (e: React.ChangeEvent<HTMLInputElement>) => {
    const recurring = e.currentTarget.checked
    debounceSync(
      () => localStorage?.setItem('recurring', `${recurring}`),
      100
    )()
  }

  useEffect(() => {
    const walletAddressUrl =
      localStorage?.getItem('walletAddressUrl') || undefined
    if (!walletAddressUrl) return
    getWalletCurrency(walletAddressUrl)
  }, [getWalletCurrency])

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        const response = await message.send('CONNECT_WALLET', {
          ...data,
          walletAddressUrl: toWalletAddressUrl(data.walletAddressUrl)
        })
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
        <Label className="text-base font-medium">Public key</Label>
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
        type="text"
        label="Wallet address or payment pointer"
        placeholder="https://ilp.rafiki.money/johndoe"
        errorMessage={errors.walletAddressUrl?.message}
        {...register('walletAddressUrl', {
          required: { value: true, message: 'Wallet address URL is required.' },
          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
            getWalletCurrency(e.currentTarget.value)
          },
          onChange: handleOnChangeWalletAddressUrl
        })}
      />
      <Input
        type="text"
        inputMode="numeric"
        addOn={currencySymbol.symbol}
        label="Amount"
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
              formatNumber(+e.currentTarget.value, currencySymbol.scale)
            )
          },
          onChange: handleOnChangeAmount
        })}
      />
      <div className="px-2">
        <Switch
          {...register('recurring', {
            onChange: handleOnChangeRecurring
          })}
          label="Renew amount monthly"
        />
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
