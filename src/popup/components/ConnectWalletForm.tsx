import { DollarSign } from '@/popup/components/Icons'
import { Button } from '@/popup/components/ui/Button'
import { Input } from '@/popup/components/ui/Input'
import { Label } from '@/popup/components/ui/Label'
import { connected } from 'process'
import React, { useContext } from 'react'
import { Switch } from '@/popup/components/ui/Switch'
import { Code } from '@/popup/components/ui/Code'
import { PopupStateContext } from '@/popup/lib/context'
import { connectWallet } from '@/popup/lib/messages'

export const ConnectWalletForm = () => {
  const { state } = useContext(PopupStateContext)

  const [walletAddressUrl, setWalletAddressUrl] = React.useState('')
  const [walletError, setWalletError] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [amountError, setAmountError] = React.useState('')
  const [recurring, setRecurring] = React.useState(false)
  const [loading, setLoading] = React.useState<boolean>(false)

  const handleConnect = async () => {
    if (loading) return

    setWalletError('')
    setAmountError('')

    setLoading(true)
    let errors = false

    if (!walletAddressUrl) {
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

    // TODO: Send amount object
    const data = await connectWallet({
      amount,
      walletAddressUrl,
      recurring
    })

    setWalletError(data.message)
  }

  return (
    <>
      <div>
        <Label className="text-base font-medium	text-medium">
          Step 1 - Public key
        </Label>
        <p>
          Get a wallet address from a provider before connecting it below.
          Please find a list of available wallets here. Copy the public key
          below and paste it into your wallet.
        </p>
        <Code className="px-2" value={state.publicKey} />
      </div>
      <Label className="text-base font-medium	text-medium">Wallet address</Label>

      <Input
        value={walletAddressUrl}
        id="wallet"
        name="wallet"
        onChange={(event) => setWalletAddressUrl(event.target.value)}
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
        onChange={(event) => setAmount(event.target.value)}
        disabled={connected}
        errorMessage={amountError}
        icon={<DollarSign />}
      />
      <Switch
        checked={recurring}
        onChange={() => setRecurring((prev) => !prev)}
      />
      <Button
        className="w-full"
        disabled={loading}
        loading={loading}
        aria-label="connect"
        onClick={handleConnect}
      >
        Connect
      </Button>
    </>
  )
}
