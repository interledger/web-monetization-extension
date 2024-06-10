import { ConnectWalletForm } from '@/popup/components/ConnectWalletForm'
import { WalletInformation } from '@/popup/components/WalletInformation'
import { PopupStateContext } from '@/popup/lib/context'
import React from 'react'

export const Component = () => {
  const { state } = React.useContext(PopupStateContext)

  if (state.connected) {
    return <WalletInformation info={state} />
  } else {
    return (
      <ConnectWalletForm
        publicKey={state.publicKey}
        amountValue={state.amountValue}
        walletAddressUrl={state.walletAddressUrl}
        recurring={state.recurring}
      />
    )
  }
}
