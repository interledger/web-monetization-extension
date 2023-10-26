import { getAxiosInstance } from '@/background/requestConfig'

const KEY_ID = '530c7caf-47a2-4cbd-844e-b8ed53e5c0d7'
const PRIVATE_KEY =
  'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSU1xYkZodTlNZHpjNXZROXBoVDY0aGZ4Z0pRazM2TFVyR1VqL1cwbHRTWG0KLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo='
const WM_PAYMENT_POINTER_URL = 'https://ilp.rafiki.money/web-monetization' // intermediarul

export const initPaymentFlow = async (
  sendingPaymentPointerUrl: string,
  receivingPaymentPointerUrl: string,
) => {
  const axiosInstance = getAxiosInstance(KEY_ID, PRIVATE_KEY)

  const payload = {
    access_token: {
      access: [
        {
          type: 'incoming-payment',
          actions: ['create', 'read', 'list'],
          identifier: sendingPaymentPointerUrl,
        },
      ],
    },
    client: WM_PAYMENT_POINTER_URL,
  }
  const clientAuth = await axiosInstance.post('https://auth.rafiki.money/', payload)

  if (clientAuth.data?.access_token?.value) {
    // create incoming payment
    const incomingPaymentPayload = {
      walletAddress: sendingPaymentPointerUrl,
      incomingAmount: {
        value: '2500',
        assetCode: 'USD',
        assetScale: 2,
      },
    }

    const headers = {
      headers: {
        Authorization: `GNAP ${clientAuth.data.access_token.value}`,
      },
    }

    const incomingPayment = await axiosInstance.post(
      'https://auth.rafiki.money/',
      incomingPaymentPayload,
      headers,
    )
    console.log('incomingPayment', incomingPayment)
  }
}
