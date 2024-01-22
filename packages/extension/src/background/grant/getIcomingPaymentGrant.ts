import { AxiosInstance } from 'axios';

type TGetIncomingPaymentGrant = (_params: {
  client: string;
  identifier: string;
  wallet: Record<string, any>;
  instance: AxiosInstance;
}) => Promise<any>;

export const getIncomingPaymentGrant: TGetIncomingPaymentGrant = async ({
  client,
  identifier,
  wallet,
  instance,
}): Promise<string> => {
  const payload = {
    access_token: {
      access: [
        {
          type: 'incoming-payment',
          actions: ['create', 'read', 'list'],
          identifier, // receivingPaymentPointerUrl
        },
      ],
    },
    client, // WM_PAYMENT_POINTER_URL
  };

  const response = await instance.post(wallet.authServer + '/', payload);

  if (!response.data.access_token.value) {
    throw new Error('No client auth');
  }

  return response.data.access_token.value;
};
