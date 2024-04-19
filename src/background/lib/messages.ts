import browser from 'webextension-polyfill'
import {
  BackgroundToContentMessage,
  BackgroundToContentAction,
  BackgroundToContentActionPayload,
  MessageManager
} from '@/shared/messages'

export const message = new MessageManager<BackgroundToContentMessage>(browser)

interface SendMonetizationEventParams {
  tabId: number
  frameId: number
  payload: BackgroundToContentActionPayload[BackgroundToContentAction.MONETIZATION_EVENT]
}

export const sendMonetizationEvent = async ({
  tabId,
  frameId,
  payload
}: SendMonetizationEventParams) => {
  return await message.sendToTab(tabId, frameId, {
    action: BackgroundToContentAction.MONETIZATION_EVENT,
    payload
  })
}
