import browser from 'webextension-polyfill'
import {
  BackgroundToContentMessage,
  BackgroundToContentAction,
  BackgroundToContentActionPayload,
  MessageManager
} from '@/shared/messages'

export const message = new MessageManager<BackgroundToContentMessage>(browser)

export const sendMonetizationEvent = async (
  tabId: number,
  frameId: number,
  payload: BackgroundToContentActionPayload[BackgroundToContentAction.MONETIZATION_EVENT]
) => {
  return await message.sendToTab(tabId, frameId, {
    action: BackgroundToContentAction.MONETIZATION_EVENT,
    payload
  })
}
