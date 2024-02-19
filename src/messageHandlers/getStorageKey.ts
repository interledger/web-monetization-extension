import browser from 'webextension-polyfill'

const storage = browser.storage.sync || browser.storage.local

const getStorageKey = async (key: any) => {
  const data = await storage.get('data')
  return {
    type: 'SUCCESS',
    [key]: data?.data[key],
  }
}

export default { callback: getStorageKey, type: 'GET_STORAGE_KEY' }
