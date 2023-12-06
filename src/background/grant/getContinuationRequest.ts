import { AxiosInstance } from 'axios'

import { getHeaders } from './getHeaders'

export const getContinuationRequest = async (
  url: string,
  interactRef: string,
  token: string,
  instance: AxiosInstance,
) => {
  const continuationRequest = await instance.post(
    url,
    {
      interact_ref: interactRef,
    },
    getHeaders(token),
  )

  if (!continuationRequest.data.access_token.value) {
    throw new Error('No continuation request')
  }

  return {
    manageUrl: continuationRequest.data.access_token.manage,
    continuationRequestToken: continuationRequest.data.access_token.value,
  }
}
