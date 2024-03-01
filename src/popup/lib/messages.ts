import { PopupState } from '@/shared/types'
import {
  MessageManager,
  PopupToBackgroundAction,
  type PopupToBackgroundMessage
} from '@/shared/messages'
import browser from 'webextension-polyfill'

export const message = new MessageManager<PopupToBackgroundMessage>(browser)

export const getContextData = async () => {
  return await message.send<PopupState>({
    action: PopupToBackgroundAction.GET_CONTEXT_DATA
  })
}
