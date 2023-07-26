/* eslint-disable */

interface Message {
  action: string
  data?: any
}

export const sendMessage = (message, tabId = null, callback) => {
  if (tabId === null) {
    queryActiveTab(tab => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, message, callback)
      }
    })
  } else {
    chrome.tabs.sendMessage(tabId, message, callback)
  }
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
