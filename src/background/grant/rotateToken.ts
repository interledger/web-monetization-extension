import { AxiosInstance } from 'axios'

import { getHeaders } from '@/background/grant/getHeaders'

export const rotateToken = async (url: string, token: string, instance: AxiosInstance) => {
  const response = await instance.post(
    url, // this.manageUrl
    undefined,
    getHeaders(token), // this.continuationRequestToken
  )

  if (!response.data.access_token.value) {
    throw new Error('No continuation request')
  }

  return {
    manageUrl: response.data.access_token.manage,
    continuationRequestToken: response.data.access_token.value,
  }
}
