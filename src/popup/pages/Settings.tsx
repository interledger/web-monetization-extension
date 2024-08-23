import { ConnectWalletForm } from '@/popup/components/ConnectWalletForm'
import { WalletInformation } from '@/popup/components/WalletInformation'
import { usePopupState } from '@/popup/lib/context'
import React from 'react'

export const Component = () => {
  const { state } = usePopupState()

  if (state.connected) {
    return <WalletInformation info={state} />
  } else {
    return <ConnectWalletForm publicKey={state.publicKey} />
  }
}
