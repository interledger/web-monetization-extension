import { storageApi } from 'shared/storage'

const getStorageData = async () => {
  try {
    const { data } = await storageApi.get('data')
    return {
      type: 'SUCCESS',
      data,
    }
  } catch (error) {
    return {
      type: 'ERROR',
      error,
    }
  }
}

export default { callback: getStorageData, type: 'GET_STORAGE_DATA' }
