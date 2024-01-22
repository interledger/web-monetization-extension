import { AxiosInstance } from 'axios';

type TGetOutgoingPaymentGrant = (_params: {
  client: string;
  identifier: string;
  wallet: Record<string, any>;
  amount: string | number;
  instance: AxiosInstance;
}) => Promise<any>;

export const getOutgoingPaymentGrant: TGetOutgoingPaymentGrant = async ({
  client,
  identifier,
  wallet,
  amount,
  instance,
}) => {
  // const receivingPaymentPointerDetails = await this.axiosInstance.get(
  //   this.receivingPaymentPointerUrl,
  // )
  const payload = {
    access_token: {
      access: [
        {
          type: 'outgoing-payment',
          actions: ['list', 'read', 'create'],
          identifier, // sendingPaymentPointerUrl
          limits: {
            debitAmount: {
              value: String(Number(amount) * 10 ** 9), // '1000000000',
              assetScale: wallet.assetScale, // 9
              assetCode: wallet.assetCode, // 'USD'
            },
          },
        },
      ],
    },
    client,
    interact: {
      start: ['redirect'],
      finish: {
        method: 'redirect',
        uri: `http://localhost:3035`,
        nonce: new Date().getTime().toString(),
      },
    },
  };

  const outgoingPaymentGrant = await instance.post(wallet.authServer + '/', payload);

  if (!outgoingPaymentGrant.data.interact.redirect) {
    throw new Error('No redirect');
  }

  return {
    outgoingPaymentGrantToken: outgoingPaymentGrant.data.continue.access_token.value,
    outgoingPaymentGrantData: outgoingPaymentGrant.data,
  };
};
