import { DollarSign } from '@/popup/components/Icons'
import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'
import { Label } from '@/popup/components/ui/Label'
import { RadioGroup } from '@/popup/components/ui/RadioGroup'
import { connected } from 'process'
import React from 'react'

export const ConnectWalletForm = () => {
  const [wallet, setWallet] = React.useState<string>('')
  const [walletError, setWalletError] = React.useState<string>('')
  const [amount, setAmount] = React.useState<string>('')
  const [amountError, setAmountError] = React.useState<string>('')
  const [recurring, setRecurring] = React.useState<string>('true')
  const [loading, setLoading] = React.useState<boolean>(false)

  const handleChangeWallet = (event: any) => {
    setWallet(event.target.value)
  }

  const handleChangeAmount = (event: any) => {
    setAmount(event.target.value)
  }

  const handleChangeRecurring = (value: string) => {
    setRecurring(value)
  }

  const handleConnect = () => {
    if (loading) return

    setWalletError('')
    setAmountError('')

    setLoading(true)
    let errors = false

    if (!wallet) {
      errors = true
      setWalletError('Please fill in wallet address')
    }
    if (!amount) {
      errors = true
      setAmountError('Please fill in the amount')
    } else if (!parseFloat(amount)) {
      errors = true
      setAmountError('Amount must be a number bigger than 0')
    }

    if (errors) {
      setLoading(false)
      return
    }

    setWalletError('')
    setAmountError('')

    setLoading(false)
  }

  return (
    <>
      <Label className="text-base font-medium	text-medium">Wallet address</Label>

      <Input
        value={wallet}
        id="wallet"
        name="wallet"
        onChange={handleChangeWallet}
        errorMessage={walletError}
        disabled={connected}
        placeholder="Enter your wallet address"
      />
      <Label className="text-base font-medium	text-medium mb-4 mt-8">
        Amount
      </Label>
      <Input
        value={amount}
        type="number"
        id="amount"
        name="amount"
        onChange={handleChangeAmount}
        disabled={connected}
        errorMessage={amountError}
        icon={<DollarSign />}
      />
      <RadioGroup
        handleChange={handleChangeRecurring}
        items={[
          { label: 'Recurring monthly amount', value: 'true' },
          { label: 'Single-use amount', value: 'false' }
        ]}
        name="recurring"
        id="recurring"
        value={recurring}
        className="mb-8 pl-2 mt-5"
        disabled={connected}
      />
      <Button
        className="w-full"
        disabled={loading}
        loading={loading}
        aria-label="connect"
      >
        {connected ? 'Disconnect' : 'Connect'}
      </Button>
    </>
  )
}
