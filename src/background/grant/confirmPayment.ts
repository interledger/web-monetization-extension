import { tabs } from 'webextension-polyfill'

const getCurrentActiveTabId = async () => {
  const activeTabs = await tabs.query({ active: true, currentWindow: true })
  return activeTabs[0].id
}

export const confirmPayment = async (url: string) => {
  const currentTabId = await getCurrentActiveTabId()

  return await new Promise<string>(resolve => {
    if (url) {
      tabs.create({ url }).then(tab => {
        if (tab.id) {
          tabs.onUpdated.addListener((tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.url?.includes('interact_ref')) {
              const interactRef = changeInfo.url.split('interact_ref=')[1]
              tabs.update(currentTabId, { active: true })
              tabs.remove(tab.id)
              resolve(interactRef)
            }
          })
        }
      })
    }
  })
}
