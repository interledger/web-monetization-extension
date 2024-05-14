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

export const stopMonetization = async (
  payload: ContentToBackgroundActionPayload[ContentToBackgroundAction.STOP_MONETIZATION]
) => {
  return await message.send({
    action: ContentToBackgroundAction.STOP_MONETIZATION,
    payload
  })
}

export const resumeMonetization = async (
  payload: ContentToBackgroundActionPayload[ContentToBackgroundAction.RESUME_MONETIZATION]
) => {
  return await message.send({
    action: ContentToBackgroundAction.RESUME_MONETIZATION,
    payload
  })
}

export const isTabMonetized = async (
  payload: ContentToBackgroundActionPayload[ContentToBackgroundAction.IS_TAB_MONETIZED]
) => {
  return await message.send({
    action: ContentToBackgroundAction.IS_TAB_MONETIZED,
    payload
  })
}

export const isWMEnabled = async () => {
  return await message.send<boolean>({
    action: ContentToBackgroundAction.IS_WM_ENABLED
  })
}
