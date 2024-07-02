import browser from 'webextension-polyfill'
import {
  MessageManager,
  BackgroundToContentAction,
  type BackgroundToContentMessage,
  type BackgroundToContentActionPayload,
  BackgroundToPopupAction,
  type BackgroundToPopupActionPayload,
  type BackgroundToPopupMessage
} from '@/shared/messages'

export const message = new MessageManager<
  BackgroundToContentMessage | BackgroundToPopupMessage
>(browser)

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

export const emitToggleWM = async (
  payload: BackgroundToContentActionPayload[BackgroundToContentAction.EMIT_TOGGLE_WM]
) => {
  return await message.sendToActiveTab({
    action: BackgroundToContentAction.EMIT_TOGGLE_WM,
    payload
  })
}

export const emitConnectedStateUpdate = async (
  payload: BackgroundToPopupActionPayload[BackgroundToPopupAction.UPDATE_CONNECTED_STATE]
) => {
  return await message.send({
    action: BackgroundToPopupAction.UPDATE_CONNECTED_STATE,
    payload
  })
}
