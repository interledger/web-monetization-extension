/* eslint-disable */
import { BrowserAPI } from '@/lib/index'

interface Message {
  action: string
  type: string
  content: any
  data?: any
}

export const sendTabsMessage = (message, tabId?, callback?) => {
  BrowserAPI.tabs.sendMessage(tabId, message, callback)

  return true
}

export function sendRuntimeMessage(
  action: string,
  payload: any,
  callback?: (response: any) => void,
) {
  BrowserAPI.runtime.sendMessage({ type: action, content: payload }, callback)
}

export const addMessageListener = (
  listener: (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => void,
) => {
  BrowserAPI.runtime.onMessage.addListener(listener)
}

export const queryActiveTab = callback => {
  BrowserAPI.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs[0]
    if (activeTab) {
      callback(activeTab)
    }
  })
}
