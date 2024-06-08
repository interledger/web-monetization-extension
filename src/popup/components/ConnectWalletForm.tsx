import browser from 'webextension-polyfill'
import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'
import { Label } from '@/popup/components/ui/Label'
import { connected } from 'process'
import React from 'react'
import { Switch } from '@/popup/components/ui/Switch'
import { Code } from '@/popup/components/ui/Code'
import { ErrorMessage } from '@/popup/components/ErrorMessage'
import { connectWallet } from '@/popup/lib/messages'
import { getWalletInformation } from '@/shared/helpers'
import {
  charIsNumber,
  formatNumber,
  getCurrencySymbol
} from '@/popup/lib/utils'
import { useForm } from 'react-hook-form'

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

  React.useEffect(() => {
    void ensureHostPermission()
  })

  const ensureHostPermission = async () => {
    const permissionOk = await browser.permissions.contains(HOSTS_PERMISSION)
    if (!permissionOk) {
      setError('root', {
        type: 'permission:hosts',
        message: browser.i18n.getMessage('hostsPermissionsNeeded')
      })
    }
    return permissionOk
  }

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
        const permissionOk = await ensureHostPermission()
        if (!permissionOk) return

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
      {errors.root && (
        <ErrorMessage
          error={errors.root.message}
          className="text-sm text-red-700"
        >
          {errors.root?.type === 'permission:hosts' && (
            <button
              type="button"
              className="inline-flex shrink-0 font-semibold text-red-800 underline"
              onClick={async () => {
                await browser.permissions
                  .request(HOSTS_PERMISSION)
                  .then((granted) => {
                    if (granted) {
                      clearErrors('root')
                    }
                  })
              }}
            >
              Grant permission
            </button>
          )}
        </ErrorMessage>
      )}

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
        type="url"
        label="Wallet address"
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
          }
        })}
      />
      <div className="px-2">
        <Switch {...register('recurring')} label="Renew amount monthly" />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || errors.root?.type === 'permission:hosts'}
        loading={isSubmitting}
        aria-label="Connect your wallet"
      >
        Connect
      </Button>
    </form>
  )
}

const HOSTS_PERMISSION = { origins: ['http://*/*', 'https://*/*'] }
