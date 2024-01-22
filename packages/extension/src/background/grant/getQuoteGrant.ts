import { AxiosInstance } from 'axios';

type TGetQuoteGrant = (_params: {
  client: string;
  identifier: string;
  wallet: Record<string, any>;
  instance: AxiosInstance;
}) => Promise<any>;

export const getQuoteGrant: TGetQuoteGrant = async ({ client, identifier, wallet, instance }) => {
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
  };
  const quoteGrant = await instance.post(wallet.authServer + '/', quotePayload);

  if (!quoteGrant.data?.access_token?.value) {
    throw new Error('No quote grant');
  }

  return quoteGrant.data.access_token.value;
};
