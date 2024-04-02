import browser from 'webextension-polyfill'
import {
  BackgroundToContentMessage,
  BackgroundToContentAction,
  BackgroundToContentActionPayload,
  MessageManager
} from '@/shared/messages'

export const message = new MessageManager<BackgroundToContentMessage>(browser)

export const sendMonetizationEvent = async (
  payload: BackgroundToContentActionPayload[BackgroundToContentAction.MONETIZATION_EVENT]
) => {
  return await message.sendToActiveTab({
    action: BackgroundToContentAction.MONETIZATION_EVENT,
    payload
  })
}
