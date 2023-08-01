/* eslint-disable */
interface Message {
  action: string
  type: string
  content: any
  data?: any
}

export const sendTabsMessage = (message, tabId?, callback?) => {
  chrome.tabs.sendMessage(tabId, message, callback)

  return true
}

export function sendRuntimeMessage(
  action: string,
  payload: any,
  callback?: (response: any) => void,
) {
  chrome.runtime.sendMessage({ type: action, content: payload }, callback)
}

export const addMessageListener = (
  listener: (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => void,
) => {
  chrome.runtime.onMessage.addListener(listener)
}

export const queryActiveTab = callback => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs[0]
    if (activeTab) {
      callback(activeTab)
    }
  })
}
