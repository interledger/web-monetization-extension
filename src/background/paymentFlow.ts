import { WM_WALLET_ADDRESS } from '@/background/config'
import { getAxiosInstance } from '@/background/requestConfig'

export const initPaymentFlow = async (
  sendingPaymentPointerUrl: string,
  receivingPaymentPointerUrl: string,
) => {
  const axiosInstance = getAxiosInstance()

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
    client: WM_WALLET_ADDRESS,
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
        client: WM_WALLET_ADDRESS,
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
            client: WM_WALLET_ADDRESS,
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

          // `https://rafiki.money/?hash=SKENFpVdQFenQ0rMiaHCFTkFq11SEFYSAUBhCrw8xvU%3D&interact_ref=10e7a3ab-496c-4d50-bea1-593189be4b75`
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
