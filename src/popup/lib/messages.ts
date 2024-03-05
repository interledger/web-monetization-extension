import { PopupState } from '@/shared/types'
import {
  MessageManager,
  PopupToBackgroundAction,
  PopupToBackgroundActionPayload,
  type PopupToBackgroundMessage
} from '@/shared/messages'
import browser from 'webextension-polyfill'

export const message = new MessageManager<PopupToBackgroundMessage>(browser)

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
