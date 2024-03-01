import { type PopupState } from '@/popup/lib/context'
import { PopupToBackgroundAction, type PopupToBackgroundMessage } from '@/utils/messages'
import { MessageManager } from '@/utils/messages'
import browser from 'webextension-polyfill'

export const message = new MessageManager<PopupToBackgroundMessage>(browser)

export const getContextData = async () => {
  return await message.send<PopupState>({
    action: PopupToBackgroundAction.GET_CONTEXT_DATA,
  })
}
