import { type WalletAddress } from '@interledger/open-payments/dist/types'

// utils function
const isWalletAddress = (o: any): o is WalletAddress => {
  return (
    o.id &&
    typeof o.id === 'string' &&
    o.assetScale &&
    typeof o.assetScale === 'number' &&
    o.assetCode &&
    typeof o.assetCode === 'string' &&
    o.authServer &&
    typeof o.authServer === 'string' &&
    o.resourceServer &&
    typeof o.resourceServer === 'string'
  )
}

// to do: rename into check?
// add validation from tag manager as well
export const checkWalletAddress = async (walletAddressUrl: string): Promise<WalletAddress> => {
  const response = await fetch(walletAddressUrl, {
    headers: {
      Accept: 'application/json',
    },
  })
  const json = await response.json()

  if (!isWalletAddress(json)) {
    throw new Error('Invalid wallet address response.')
  }

  return json
}
