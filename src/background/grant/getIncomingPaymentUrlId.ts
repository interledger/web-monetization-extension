import { Axios } from 'axios'

import { getHeaders } from './getHeaders'

export const getIncomingPaymentUrlId = async (
  walletAddress: string,
  token: string,
  instance: Axios,
): Promise<string> => {
  const incomingPayment = await instance.post(
    new URL(walletAddress).origin + '/incoming-payments',
    {
      walletAddress, // receivingPaymentPointerUrl
      expiresAt: new Date(Date.now() + 6000 * 60 * 10).toISOString(),
    },
    getHeaders(token),
  )

  if (!incomingPayment?.data?.id) {
    throw new Error('No incoming payment id')
  }

  return incomingPayment.data.id
}
