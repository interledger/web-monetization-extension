import { type WalletAddress } from '@interledger/open-payments/dist/types'

import { Amount } from '@/utils/types'

interface ExceptionWebsiteAmountList {
  [website: string]: Amount
}

interface AccessToken {
  value: string
  manage: string
}

export class StorageService {
  // is connected wallet general
  connected: boolean
  // user waller address
  walletAddress?: WalletAddress
  // general amount
  amount?: Amount
  // wm general enabled
  enabled: boolean
  // access token for quoring & outgoing payments
  accessToken?: AccessToken
  // exeption list with websites and each specific amount
  exceptionList: ExceptionWebsiteAmountList

  publicKey: string
  privateKey: string
  keyId: string
}
