import { AxiosInstance } from 'axios'

export const getQuoteGrant = async (
  client: string,
  identifier: string,
  wallet: Record<string, any>,
  instance: AxiosInstance,
): Promise<string> => {
  const quotePayload = {
    access_token: {
      access: [
        {
          type: 'quote',
          actions: ['create'],
          identifier,
        },
      ],
    },
    client, // WM_PAYMENT_POINTER_URL
  }
  const quoteGrant = await instance.post(wallet.authServer + '/', quotePayload)

  if (!quoteGrant.data?.access_token?.value) {
    throw new Error('No quote grant')
  }

  return quoteGrant.data.access_token.value
}
