import browser from 'webextension-polyfill'

const storage = browser.storage.local

const setStorageData = async (data: any) => {
  await storage.set([{ data: data }])

  return {
    type: 'SUCCESS',
  }
}

export default { callback: setStorageData, type: 'SET_STORAGE_DATA' }
