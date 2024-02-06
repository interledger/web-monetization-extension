import { Tabs, tabs } from 'webextension-polyfill'

import { sendMessageToTab } from '@/utils/sendMessages'

import { updateIcon } from './utils'

export const tabChangeHandler = async (activeInfo: chrome.tabs.TabActiveInfo) => {
  const tabId = activeInfo.tabId
  const tab = await tabs.get(tabId)

  if (tab && tab.url?.includes('https') && tab.status === 'complete') {
    try {
      const response = await sendMessageToTab(tab, { type: 'IS_MONETIZATION_READY' })
      if (response?.data) {
        updateIcon(response.data.monetization)
      }
    } catch (error) {
      console.log(`[===== Error in tabChangeHandler =====]`, error)
    }
  }
}

export const tabUpdateHandler = async (
  tabId: number,
  changeInfo: Tabs.OnUpdatedChangeInfoType,
  tab: Tabs.Tab,
) => {
  if (tab.status === 'complete' && tab.url?.match(/^http/)) {
    try {
      const response = await sendMessageToTab(tab, { type: 'IS_MONETIZATION_READY' })
      if (response?.data) {
        updateIcon(response.data.monetization)
      }
    } catch (error) {
      console.log(`[===== Error in tabUpdateHandler =====]`, error)
    }
  }
}
