import { AxiosInstance } from 'axios';

import { getHeaders } from './getHeaders';

type TGetContinuationRequest = (_params: {
  url: string;
  interactRef: any;
  token: string;
  instance: AxiosInstance;
}) => Promise<any>;

export const getContinuationRequest: TGetContinuationRequest = async ({
  url,
  interactRef,
  token,
  instance,
}) => {
  const continuationRequest = await instance.post(
    url,
    {
      interact_ref: interactRef,
    },
    getHeaders(token),
  );

  if (!continuationRequest.data.access_token.value) {
    throw new Error('No continuation request');
  }

  return {
    manageUrl: continuationRequest.data.access_token.manage,
    continuationRequestToken: continuationRequest.data.access_token.value,
  };
};
