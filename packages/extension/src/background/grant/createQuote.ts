import { AxiosInstance } from 'axios';

import { getHeaders } from './getHeaders';

type TCreateQuote = (_params: {
  receiver: string;
  walletAddress: any;
  sendingUrl: string;
  token: string;
  amount: string;
  instance: AxiosInstance;
}) => Promise<any>;

export const createQuote: TCreateQuote = async ({
  receiver,
  walletAddress,
  sendingUrl,
  token,
  amount,
  instance,
}) => {
  const payload = {
    method: 'ilp',
    receiver,
    walletAddress: walletAddress.id,
    debitAmount: {
      value: amount, // 0.001 USD
      assetCode: walletAddress.assetCode, // 'USD'
      assetScale: walletAddress.assetScale, // 9
    },
  };

  const quote = await instance.post(
    new URL(sendingUrl).origin + '/quotes',
    payload,
    getHeaders(token),
  );

  if (!quote.data.id) {
    throw new Error('No quote url id');
  }

  return quote.data.id;
};
