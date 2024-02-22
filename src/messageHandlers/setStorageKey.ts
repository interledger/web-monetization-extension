import { storageApi } from '@/utils/storage'

const setStorageKey = async ({ key, value }: { key: string; value: any }) => {
  try {
    const storageData = await storageApi.get('data')
    await storageApi.set({ data: { ...storageData, [key]: value } })
    return { type: 'SUCCESS' }
  } catch (error) {
    return { type: 'ERROR', error }
  }
}

export default { callback: setStorageKey, type: 'SET_STORAGE_KEY' }
