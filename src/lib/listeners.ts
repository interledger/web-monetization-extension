import { addMessageListener } from '@lib/messageUtils'

export const initListeners = () => {
  addMessageListener(({ action }, sender, sendResponse) => {
    if (action === 'GET_MONETIZATION') {
      const monetization = document.querySelector('link[rel="monetization"]')
      sendResponse(!!monetization)
    }

    return true
  })
}
