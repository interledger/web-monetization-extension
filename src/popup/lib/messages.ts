import {
  BackgroundToContentAction,
  BackgroundToContentActionPayload,
  BackgroundToContentMessage,
  MessageManager,
  PopupToBackgroundAction,
  PopupToBackgroundActionPayload,
  type PopupToBackgroundMessage
} from '@/shared/messages'
import browser from 'webextension-polyfill'
import { PopupState } from '@/popup/lib/context'

export const message = new MessageManager<
  PopupToBackgroundMessage | BackgroundToContentMessage
>(browser)

export const getContextData = async () => {
  return await message.send<PopupState>({
    action: PopupToBackgroundAction.GET_CONTEXT_DATA
  })
}

// TBD: Save error message in storage and to discuss other alternatives
export const connectWallet = async (
  payload: PopupToBackgroundActionPayload[PopupToBackgroundAction.CONNECT_WALLET]
) => {
  return await message.send({
    action: PopupToBackgroundAction.CONNECT_WALLET,
    payload
  })
}

export const disconnectWallet = async () => {
  return await message.send({
    action: PopupToBackgroundAction.DISCONNECT_WALLET
  })
}

export const toggleWM = async () => {
  return await message.send({
    action: PopupToBackgroundAction.TOGGLE_WM
  })
}

export const updateRateOfPay = async (
  payload: PopupToBackgroundActionPayload[PopupToBackgroundAction.UPDATE_RATE_OF_PAY]
) => {
  return await message.send({
    action: PopupToBackgroundAction.UPDATE_RATE_OF_PAY,
    payload
  })
}

export const payWebsite = async (
  payload: PopupToBackgroundActionPayload[PopupToBackgroundAction.PAY_WEBSITE]
) => {
  return await message.send({
    action: PopupToBackgroundAction.PAY_WEBSITE,
    payload
  })
}
