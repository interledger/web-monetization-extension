import browser from 'webextension-polyfill'

const storage = browser.storage.local

const getStorageData = async () => {
  const data = await storage.get('data')
  return {
    type: 'SUCCESS',
    data,
  }
}

export default { callback: getStorageData, type: 'GET_STORAGE_DATA' }
