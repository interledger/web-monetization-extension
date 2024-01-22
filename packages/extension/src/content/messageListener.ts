// import { Runtime } from 'webextension-polyfill'

import { PaymentSender } from '@/content/monetization';

const paymentSender = new PaymentSender();

export const onRequest = async (
  msg: EXTMessage,
  // sender: Runtime.SendMessageOptionsType,
): Promise<EXTResponse | undefined> => {
  // console.log('~~~~~~~', msg)

  switch (msg.type) {
    case 'IS_MONETIZATION_READY': {
      const monetizationTag = document.querySelector('link[rel="monetization"]');

      return {
        type: 'SUCCESS',
        data: {
          monetization: !!monetizationTag,
          paymentPointer: monetizationTag?.getAttribute('href'),
        },
      };
    }

    case 'START_PAYMENTS': {
      paymentSender.start();
      break;
    }

    case 'STOP_PAYMENTS': {
      paymentSender.stop();
      break;
    }

    case 'PAYMENT_SUCCESS': {
      const { receiveAmount, incomingPayment, paymentPointer } = msg.data;

      window.dispatchEvent(
        new CustomEvent('monetization-v2', {
          detail: {
            amount: receiveAmount.value as string,
            assetCode: receiveAmount.assetCode as string,
            assetScale: receiveAmount.assetScale as number,
            amountSent: {
              currency: receiveAmount.assetCode as string,
              amount: (receiveAmount.value * 10 ** -receiveAmount.assetScale) as number,
            },
            paymentPointer: paymentPointer as string,
            incomingPayment: incomingPayment as string,
            receipt: null,
          },
        }),
      );

      break;
    }

    default:
      return { type: 'SUCCESS' };
  }
};

export default onRequest;
