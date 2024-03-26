import {
  MessageManager,
  ContentToBackgroundAction,
  ContentToBackgroundActionPayload,
  type ContentToBackgroundMessage
} from '@/shared/messages'
import { WalletAddress } from '@interledger/open-payments/dist/types'
import browser from 'webextension-polyfill'

export const message = new MessageManager<ContentToBackgroundMessage>(browser)

export const checkWalletAddressUrlCall = async (
  payload: ContentToBackgroundActionPayload[ContentToBackgroundAction.CHECK_WALLET_ADDRESS_URL]
) => {
  return await message.send<WalletAddress>({
    action: ContentToBackgroundAction.CHECK_WALLET_ADDRESS_URL,
    payload
  })
}

export const startMonetization = async (
  payload: ContentToBackgroundActionPayload[ContentToBackgroundAction.START_MONETIZATION]
) => {
  return await message.send({
    action: ContentToBackgroundAction.START_MONETIZATION,
    payload
  })
}
