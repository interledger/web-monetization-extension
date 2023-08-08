import { BrowserAPI } from '@/lib/index'
import { addMessageListener, sendRuntimeMessage } from '@/lib/messageUtils'

export const initListeners = () => {
  const monetization = document.querySelector('link[rel="monetization"]')
  sendRuntimeMessage('MONETIZATION_START', !!monetization)

  addMessageListener(({ action }, sender, sendResponse) => {
    if (action === 'GET_MONETIZATION') {
      sendResponse(!!monetization)
    }

    return true
  })
}

// eslint-disable-next-line no-unused-vars
type TabChangeListener = (activeInfo: chrome.tabs.TabActiveInfo) => void

export function addTabChangeListener(listener: TabChangeListener) {
  BrowserAPI.tabs.onActivated.addListener(listener)
}
