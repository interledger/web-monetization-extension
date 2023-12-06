import { AxiosInstance } from 'axios'

import { getHeaders } from './getHeaders'

export const createQuote = async (
  receiver: string,
  walletAddress: string,
  sendingUrl: string,
  token: string,
  instance: AxiosInstance,
) => {
  const payload = {
    method: 'ilp',
    receiver,
    walletAddress,
    debitAmount: {
      value: '1000000', // 0.001 USD
      assetCode: 'USD',
      assetScale: 9,
    },
  }

  const quote = await instance.post(
    new URL(sendingUrl).origin + '/quotes',
    payload,
    getHeaders(token),
  )

  if (!quote.data.id) {
    throw new Error('No quote url id')
  }

  return quote.data.id
}
