import { Input } from '@/popup/components/ui/Input'
import { Label } from '@/popup/components/ui/Label'
import React from 'react'
import { Code } from '@/popup/components/ui/Code'
import { getCurrencySymbol, transformBalance } from '@/popup/lib/utils'
import { PopupStore } from '@/shared/types'
import { Button } from '@/popup/components/ui/Button'
import { disconnectWallet } from '@/popup/lib/messages'
import { useForm } from 'react-hook-form'

interface WalletInformationProps {
  info: PopupStore
}

export const WalletInformation = ({ info }: WalletInformationProps) => {
  const {
    handleSubmit,
    formState: { isSubmitting }
  } = useForm()

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Public key</Label>
        <p className="px-2 text-xs">
          Copy the public key below and paste it into your connected wallet.
        </p>
        <Code className="text-xs" value={info.publicKey} />
      </div>
      <Input
        className="bg-disabled"
        label="Wallet address"
        disabled={true}
        readOnly={true}
        value={info.walletAddress?.id}
      />
      <Input
        addOn={getCurrencySymbol(info.walletAddress?.assetCode ?? 'USD')}
        className="bg-disabled"
        label="Remaining balance"
        disabled={true}
        readOnly={true}
        value={transformBalance(
          info.amount?.value ?? '0',
          info.walletAddress?.assetScale ?? 2
        )}
      />
      {/* TODO: Improve error handling */}
      <form
        onSubmit={handleSubmit(async () => {
          await disconnectWallet()
          window.location.reload()
        })}
      >
        <Button
          type="submit"
          variant="destructive"
          className="w-full"
          aria-label="Connect your wallet"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          Disconnect
        </Button>
      </form>
    </div>
  )
}
