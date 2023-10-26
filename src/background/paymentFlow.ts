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
          identifier: receivingPaymentPointerUrl,
        },
      ],
    },
    client: WM_PAYMENT_POINTER_URL,
  }
  const clientAuth = await axiosInstance.post('https://auth.rafiki.money/', payload)

  if (clientAuth.data?.access_token?.value) {
    const headers = {
      headers: {
        Authorization: `GNAP ${clientAuth.data.access_token.value}`,
      },
    }

    const incomingPayment = await axiosInstance.post(
      `${receivingPaymentPointerUrl}/incoming-payments`,
      {},
      headers,
    )
    const incomingPaymentUrlId = incomingPayment?.data?.id

    if (incomingPaymentUrlId) {
      const quotePayload = {
        access_token: {
          access: [
            {
              type: 'quote',
              actions: ['create'],
              identifier: sendingPaymentPointerUrl,
            },
          ],
        },
        client: WM_PAYMENT_POINTER_URL,
      }
      const quoteGrant = await axiosInstance.post('https://auth.rafiki.money/', quotePayload)

      if (quoteGrant.data?.access_token?.value) {
        const headersQuote = {
          headers: {
            Authorization: `GNAP ${quoteGrant.data.access_token.value}`,
          },
        }

        const quote = await axiosInstance.post(
          `${sendingPaymentPointerUrl}/quotes`,
          {
            receiver: incomingPaymentUrlId,
            debitAmount: {
              value: '1000',
              assetCode: 'USD',
              assetScale: 2,
            },
          },
          { ...headersQuote },
        )

        const quoteUrlId = quote.data.id

        if (quoteUrlId) {
          const outgoingGrantPayload = {
            access_token: {
              access: [
                {
                  type: 'outgoing-payment',
                  actions: ['create', 'read', 'list'],
                  identifier: sendingPaymentPointerUrl,
                  limits: {
                    debitAmount: {
                      value: '2000',
                      assetScale: 2,
                      assetCode: 'USD',
                    },
                  },
                },
              ],
            },
            client: WM_PAYMENT_POINTER_URL,
            interact: {
              start: ['redirect'],
              finish: {
                method: 'redirect',
                uri: `https://localhost:3000/`,
                nonce: new Date().getTime().toString(),
              },
            },
          }

          const outgoingPaymentGrant = await axiosInstance.post(
            'https://auth.rafiki.money/',
            outgoingGrantPayload,
          )
          console.log('outgoingPaymentGrant', outgoingPaymentGrant.data.interact.redirect)

          // `https://localhost:3000/?hash=SKENFpVdQFenQ0rMiaHCFTkFq11SEFYSAUBhCrw8xvU%3D&interact_ref=10e7a3ab-496c-4d50-bea1-593189be4b75`
          const interactRef = '10e7a3ab-496c-4d50-bea1-593189be4b75'

          if (outgoingPaymentGrant.data.interact.redirect) {
            const continuationRequestHeaders = {
              headers: {
                Authorization: `GNAP ${outgoingPaymentGrant.data.continue.access_token.value}`,
              },
            }

            const continuationRequest = await axiosInstance.post(
              outgoingPaymentGrant.data.continue.uri,
              {
                interact_ref: interactRef,
              },
              { ...continuationRequestHeaders },
            )

            console.log('continuationRequest', continuationRequest.data.access_token.value)

            const outgoingPaymentHeaders = {
              headers: {
                Authorization: `GNAP ${continuationRequest.data.access_token.value}`,
              },
            }

            const outgoingPayment = await axiosInstance.post(
              `${sendingPaymentPointerUrl}/outgoing-payments`,
              {
                quoteId: quoteUrlId,
              },
              { ...outgoingPaymentHeaders },
            )

            console.log('outgoingPayment', outgoingPayment)
          }
        }
      }
    }
  }
}
