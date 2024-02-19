import browser from 'webextension-polyfill'

const storage = browser.storage.sync || browser.storage.local

const getStorageKey = async ({ key, value }: { key: string; value: any }) => {
  await storage.set({ [key]: value })
  return { type: 'SUCCESS' }
}

export default { callback: getStorageKey, type: 'SET_STORAGE_KEY' }
