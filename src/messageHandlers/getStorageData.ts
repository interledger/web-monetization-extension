import Background from '@/background/Background'

const getStorageData = async (background: Background) => {
  console.log('getStorageData background', background)
  return {
    type: 'SUCCESS',
    data: {
      someData: 'data',
    },
  }
}

export default { callback: getStorageData, type: 'GET_STORAGE_DATA' }
