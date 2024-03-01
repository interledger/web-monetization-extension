import { storageApi } from 'shared/storage'

const setStorageKey = async ({ key, value }: { key: string; value: any }) => {
  try {
    await storageApi.set({ [key]: value })
    return { type: 'SUCCESS' }
  } catch (error) {
    return { type: 'ERROR', error }
  }
}

export default { callback: setStorageKey, type: 'SET_STORAGE_KEY' }
