import { AxiosInstance } from 'axios';

import { getHeaders } from './getHeaders';

type TGetIncomingPaymentUrlId = (_params: {
  walletAddress: string;
  token: string;
  instance: AxiosInstance;
}) => Promise<any>;

export const getIncomingPaymentUrlId: TGetIncomingPaymentUrlId = async ({
  walletAddress,
  token,
  instance,
}) => {
  const incomingPayment = await instance.post(
    new URL(walletAddress).origin + '/incoming-payments',
    {
      walletAddress, // receivingPaymentPointerUrl
      expiresAt: new Date(Date.now() + 6000 * 60 * 10).toISOString(),
    },
    getHeaders(token),
  );

  if (!incomingPayment?.data?.id) {
    throw new Error('No incoming payment id');
  }

  return incomingPayment.data.id;
};
