export { initListeners } from './listeners'
export { addMessageListener, sendRuntimeMessage, sendTabsMessage } from './messageUtils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BrowserAPI: any = typeof browser !== 'undefined' ? browser : chrome
