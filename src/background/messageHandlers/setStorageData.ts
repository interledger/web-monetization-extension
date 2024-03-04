import { storageApi } from 'shared/storage'

const setStorageData = async (data: any) => {
  try {
    await storageApi.set({ data })
    return {
      type: 'SUCCESS'
    }
  } catch (error) {
    return {
      type: 'ERROR',
      error
    }
  }
}

export default { callback: setStorageData, type: 'SET_STORAGE_DATA' }
