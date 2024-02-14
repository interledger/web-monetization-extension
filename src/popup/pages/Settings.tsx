import React, { useState } from 'react'

import { Input } from '@/components/input'
import { Label } from '@/components/label'
import { RadioGroup } from '@/components/radio-group'
import { Button } from '@/components/button'
import { DollarSign, WarningSign } from '@/components/icons'

import { usePopup } from '@/providers/popup.state'

export const Settings = () => {
  const {
    data: {
      connected,
      wmEnabled,
      wallet,
      amount,
      amountType: { recurring },
    },
    setData,
  } = usePopup()

  const [_wallet, setWallet] = useState<string>(wallet)
  const [_walletError, setWalletError] = useState<string>('')
  const [_amount, setAmount] = useState<string>(`${amount}`)
  const [_amountError, setAmountError] = useState<string>('')
  const [_recurring, setRecurring] = useState<string>(`${recurring}`)
  const [loading, setLoading] = useState<boolean>(false)

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

    if (!_wallet) {
      errors = true
      setWalletError('Please fill in wallet address')
    }
    if (!_amount) {
      errors = true
      setAmountError('Please fill in the amount')
    } else if (!parseFloat(_amount)) {
      errors = true
      setAmountError('Amount must be a number bigger than 0')
    }

    if (errors) {
      setLoading(false)
      return
    }

    setWalletError('')
    setAmountError('')

    setData(prevState => ({
      ...prevState,
      amount: parseFloat(_amount),
      wallet: _wallet,
      amountType: { recurring: _recurring === 'true' },
      connected: true,
    }))

    setLoading(false)
  }

  const handleDisconnect = () => {
    setData(prevState => ({
      ...prevState,
      connected: false,
    }))
  }

  const switchConnect = () => {
    if (!connected) handleConnect()
    else handleDisconnect()
  }

  if (!wmEnabled)
    return (
      <div className="flex items-center">
        <WarningSign />
        <p className="text-medium text-medium pl-2">Web Monetization has been turned off.</p>
      </div>
    )

  return (
    <>
      <Label className="text-base font-medium	text-medium mb-4">Connect your wallet</Label>
      <div className="mb-4 pl-2">
        <p className="text-xs font-medium	text-medium inline">
          Get a wallet address from a provider before connecting it below. Please find a list of
          available wallets
        </p>
        <a href="/" className="text-xs font-medium text-primary inline pl-1">
          here.
        </a>
      </div>
      <Input
        value={_wallet}
        id="wallet"
        name="wallet"
        onChange={handleChangeWallet}
        errorMessage={_walletError}
        disabled={connected}
        placeholder="Enter your wallet address"
      />
      <Label className="text-base font-medium	text-medium mb-4 mt-8">Amount</Label>
      <Input
        value={_amount}
        type="number"
        id="amount"
        name="amount"
        onChange={handleChangeAmount}
        disabled={connected}
        errorMessage={_amountError}
        icon={<DollarSign />}
      />
      <RadioGroup
        handleChange={handleChangeRecurring}
        items={[
          { label: 'Recurring monthly amount', value: 'true' },
          { label: 'Single-use amount', value: 'false' },
        ]}
        name="recurring"
        id="recurring"
        value={_recurring}
        className="mb-8 pl-2 mt-5"
        disabled={connected}
      />
      <Button className="w-full" onClick={switchConnect} disabled={loading} loading={loading}>
        {connected ? 'Disconnect' : 'Connect'}
      </Button>
    </>
  )
}
