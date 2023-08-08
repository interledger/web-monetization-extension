export { initListeners } from './listeners'
export { addMessageListener, sendRuntimeMessage, sendTabsMessage } from './messageUtils'

export const BrowserAPI: any = typeof browser !== 'undefined' ? browser : chrome
