import { Input } from '@/popup/components/ui/Input'
import { Label } from '@/popup/components/ui/Label'
import React from 'react'
import { Code } from '@/popup/components/ui/Code'
import { getCurrencySymbol, transformBalance } from '@/popup/lib/utils'
import { PopupState } from '@/shared/types'
import { Button } from '@/popup/components/ui/Button'
import { disconnectWallet } from '@/popup/lib/messages'

interface WalletInformationProps {
  info: PopupState
}

export const WalletInformation = ({ info }: WalletInformationProps) => {
  const test = async () => {
    await disconnectWallet()
    window.location.reload()
  }

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
      <Button
        onClick={test}
        variant="destructive"
        className="w-full"
        aria-label="Connect your wallet"
      >
        Disconnect
      </Button>
    </div>
  )
}
