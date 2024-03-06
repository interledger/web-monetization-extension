import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'
import { Label } from '@/popup/components/ui/Label'
import { connected } from 'process'
import React from 'react'
import { Switch } from '@/popup/components/ui/Switch'
import { Code } from '@/popup/components/ui/Code'
import { connectWallet } from '@/popup/lib/messages'
import { getWalletInformation } from '@/shared/helpers'
import { getCurrencySymbol } from '@/popup/lib/utils'
import { useForm } from 'react-hook-form'

interface ConnectWalletFormInputs {
  walletAddressUrl: string
  amount: string
  recurring: boolean
}

interface ConnectWalletFormProps {
  publicKey: string
}

/**
 * TODOS:
 * - [ ] Add error handling
 * - [ ] Decide where to display each fields error message - right now adding an error will add scroll bars to our popup
 * - [ ] Decide where to display a general form error message (unexpected errror when trying to connect)
 */
export const ConnectWalletForm = ({ publicKey }: ConnectWalletFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    clearErrors
  } = useForm<ConnectWalletFormInputs>({
    criteriaMode: 'firstError',
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues: {
      recurring: false
    }
  })
  const [currencySymbol, setCurrencySymbol] = React.useState('$')

  const getWalletCurrency = async (walletAddressUrl: string): Promise<void> => {
    clearErrors('walletAddressUrl')
    if (walletAddressUrl === '' || walletAddressUrl.length < 8) return
    try {
      const url = new URL(walletAddressUrl)
      const walletAddress = await getWalletInformation(url.toString())
      setCurrencySymbol(getCurrencySymbol(walletAddress.assetCode))
    } catch (e) {
      // TODO: Set field errors
      // setError('walletAddressUrl', {
      //   type: 'validate',
      //   message: 'Invalid wallet address URL.'
      // })
    }
  }

  return (
    <form
      onSubmit={handleSubmit((data) => {
        connectWallet(data)
      })}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label className="text-base font-medium">Step 1 - Public key</Label>
        <p className="px-2 text-xs">
          Get a wallet address from a provider before connecting it below.
          Please find a list of available wallets here.
          <br /> <br />
          Copy the public key below and paste it into your wallet.
        </p>
        <Code className="text-xs" value={publicKey} />
      </div>
      <Input
        label="Step 2 - Wallet address"
        disabled={connected}
        placeholder="https://ilp.rafiki.money/johndoe"
        errorMessage={errors.walletAddressUrl?.message}
        {...register('walletAddressUrl', {
          // required: { value: true, message: 'Wallet address URL is required.' },
          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
            getWalletCurrency(e.currentTarget.value)
          }
        })}
      />
      <Input
        type="number"
        disabled={connected}
        addOn={currencySymbol}
        label="Step 3 - Amount"
        description="Enter the amount to use from your wallet."
        placeholder="5.00"
        errorMessage={errors.amount?.message}
        {...register('amount')}
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
