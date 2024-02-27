import { storageApi } from '@/utils/storage'

const getStorageKey = async (key: any) => {
  try {
    const data = await storageApi.get(key)
    return {
      type: 'SUCCESS',
      [key]: data?.[key],
    }
  } catch (error) {
    return {
      type: 'ERROR',
      error,
    }
  }
}

export default { callback: getStorageKey, type: 'GET_STORAGE_KEY' }
