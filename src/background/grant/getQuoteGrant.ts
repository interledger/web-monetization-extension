import { AxiosInstance } from 'axios'

type TGetQuoteGrant = (_params: {
  client: string
  wallet: Record<string, any>
  instance: AxiosInstance
}) => Promise<any>

export const getQuoteGrant: TGetQuoteGrant = async ({ client, wallet, instance }) => {
  const quotePayload = {
    access_token: {
      access: [
        {
          type: 'quote',
          actions: ['create'],
        },
      ],
    },
    client, // WM_PAYMENT_POINTER_URL
  }
  const quoteGrant = await instance.post(wallet.authServer, quotePayload)

  if (!quoteGrant.data?.access_token?.value) {
    throw new Error('No quote grant')
  }

  return quoteGrant.data.access_token.value
}

// {
//   "Accept": "application/json",
//   "Content-Digest": "sha-512=:+/M9IKdP9PawF65LBIErfMmEZBkswo1JDEXvM1eYdrihyF1/T5yrw7lJWuumKPzs5fOkN9wacyINwShmBZVRHw==:",
//   "Content-Length": "105",
//   "Content-Type": "application/json",
//   "Signature": "sig1=:0rGU042AQyKnAeJ8seVU0wVQHJ7Zd+qusxhxrUFQXMCXwWHH6maRAdv8xOUnfko2DBUNSBMp/Sc4RIKtAYDeDg==:",
//   "Signature-Input": 'sig1=("@method" "@target-uri" "content-digest" "content-length" "content-type");created=1706802462;keyid="b4213094-cc29-4622-9ac5-eaa6b71ef24a";alg="ed25519"'
// }

// Accept: 'application/json',
//   'Content-Type': 'application/json',
//   'Content-Digest': 'sha-512=:+/M9IKdP9PawF65LBIErfMmEZBkswo1JDEXvM1eYdrihyF1/T5yrw7lJWuumKPzs5fOkN9wacyINwShmBZVRHw==:',
//   'Content-Length': '105',
//   Signature: 'sig1=:tQcbSaKuIBb0okJOdwxhFcEfNUn3Cz1NDhK6C/LXafeobg9woVLKDY8kapmnpPerzWRCjQo+UPtO5zsZoVDnDg==:',
//   'Signature-Input': 'sig1=("@method" "@target-uri" "content-digest" "content-length" "content-type");created=1706802286;keyid="b4213094-cc29-4622-9ac5-eaa6b71ef24a";alg="ed25519"'
