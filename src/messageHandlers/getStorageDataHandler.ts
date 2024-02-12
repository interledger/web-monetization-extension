import Background from '@/background/Background'

const getStorageData = async (data: undefined, background: Background) => {
  return new Promise(resolve => {
    try {
      chrome.storage.local.set({ test: 'test' })
      chrome.storage.local.get(['test'], (res: any) => {
        resolve({
          type: 'SUCCESS',
          data: { status: 'true', res },
        })
      })
    } catch (err) {
      resolve({
        type: 'ERROR',
        data: { status: false, err },
      })
    }
  })
}

export default { callback: getStorageData, type: 'GET_STORAGE_DATA' }
