import {
  type AuthenticatedClient,
  createAuthenticatedClient,
} from '@interledger/open-payments/dist/client'
import { isPendingGrant, WalletAddress } from '@interledger/open-payments/dist/types'
import * as ed from '@noble/ed25519'
import { type Request } from 'http-message-signatures'
import { signMessage } from 'http-message-signatures/lib/httpbis'
import { createContentDigestHeader } from 'httpbis-digest-headers'
import { Browser } from 'webextension-polyfill'

interface KeyInformation {
  privateKey: string
  keyId: string
}

export interface SignatureHeaders {
  Signature: string
  'Signature-Input': string
}

interface ContentHeaders {
  'Content-Digest': string
  'Content-Length': string
  'Content-Type': string
}
type Headers = SignatureHeaders & Partial<ContentHeaders>

interface RequestLike extends Request {
  body?: string
}

interface SignOptions {
  request: RequestLike
  privateKey: Uint8Array
  keyId: string
}

interface VerifyInteractionHashParams {
  clientNonce: string
  interactRef: string
  interactNonce: string
  hash: string
  authServer: string
}

export class OpenPaymentsService {
  client?: AuthenticatedClient

  constructor(private browser: Browser) {
    // TO DO: init client if wallet already connected
  }

  private async getPrivateKeyInformation(): Promise<KeyInformation> {
    const data = await this.browser.storage.sync.get(['privateKey', 'keyId'])
    if (data.privateKey && data.keyId) {
      return data as KeyInformation
    }
    throw new Error('Could not create OpenPayments client. Missing `privateKey` and `keyId`.')
  }

  private createContentHeaders(body: string): ContentHeaders {
    return {
      'Content-Digest': createContentDigestHeader(JSON.stringify(JSON.parse(body)), ['sha-512']),
      'Content-Length': new TextEncoder().encode(body).length.toString(),
      'Content-Type': 'application/json',
    }
  }

  private createSigner(key: Uint8Array, keyId: string) {
    return {
      id: keyId,
      alg: 'ed25519',
      async sign(data: Uint8Array) {
        return Buffer.from(await ed.signAsync(data, key.slice(16)))
      },
    }
  }

  private async createSignatureHeaders({
    request,
    privateKey,
    keyId,
  }: SignOptions): Promise<SignatureHeaders> {
    const components = ['@method', '@target-uri']
    if (request.headers['Authorization'] || request.headers['authorization']) {
      components.push('authorization')
    }

    if (request.body) {
      components.push('content-digest', 'content-length', 'content-type')
    }

    const signingKey = this.createSigner(privateKey, keyId)
    const { headers } = await signMessage(
      {
        name: 'sig1',
        params: ['keyid', 'created'],
        fields: components,
        key: signingKey,
      },
      {
        url: request.url,
        method: request.method,
        headers: request.headers,
      },
    )

    return {
      Signature: headers['Signature'] as string,
      'Signature-Input': headers['Signature-Input'] as string,
    }
  }

  private async createHeaders({ request, privateKey, keyId }: SignOptions): Promise<Headers> {
    if (request.body) {
      const contentHeaders = this.createContentHeaders(request.body)
      request.headers = { ...request.headers, ...contentHeaders }
    }

    const signatureHeaders = await this.createSignatureHeaders({ request, privateKey, keyId })

    return {
      ...request.headers,
      ...signatureHeaders,
    }
  }

  private async createQuoteAndOutgoingPaymentGrant(
    nonce: string,
    authServer: string,
    walletAddress: WalletAddress,
    amount: string,
  ) {
    const grant = await this.client!.grant.request(
      {
        url: authServer,
      },
      {
        access_token: {
          access: [
            {
              type: 'quote',
              actions: ['create'],
            },
            {
              type: 'outgoing-payment',
              actions: ['create'],
              identifier: walletAddress.id,
              limits: {
                debitAmount: {
                  value: String(Number(amount) * 10 ** walletAddress.assetScale),
                  assetScale: walletAddress.assetScale,
                  assetCode: walletAddress.assetCode,
                },
              },
            },
          ],
        },
        interact: {
          start: ['redirect'],
          finish: {
            method: 'redirect',
            uri: 'http://localhost:3344',
            nonce,
          },
        },
      },
    )

    if (!isPendingGrant(grant)) {
      throw new Error('Expected interactive grant. Received non-pending grant.')
    }

    return grant
  }

  // Fourth item- https://rafiki.dev/concepts/open-payments/grant-interaction/#endpoints
  private async verifyInteractionHash({
    clientNonce,
    interactRef,
    interactNonce,
    hash,
    authServer,
  }: VerifyInteractionHashParams): Promise<void> {
    // Notice: The interaction hash is not correctly calculated within Rafiki at the momenet in certain scenarios.
    // If at one point this will throw an error check the `grantEndpoint` value.
    // `grantEndpoint` represents the route where grants are requested.
    const grantEndpoint = new URL(authServer).origin + '/'
    const data = new TextEncoder().encode(
      `${clientNonce}\n${interactNonce}\n${interactRef}\n${grantEndpoint}`,
    )

    const digest = await crypto.subtle.digest('SHA-256', data)
    const calculatedHash = btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    if (calculatedHash !== hash) throw new Error('Invalid interaction hash')
  }

  async initClient(walletAddressUrl: string) {
    console.log('init client')
    const { privateKey, keyId } = await this.getPrivateKeyInformation()
    this.client = await createAuthenticatedClient({
      walletAddressUrl,
      authenticatedRequestInterceptor: async config => {
        if (!config.method || !config.url) {
          throw new Error('Cannot intercept request: url or method missing')
        }

        const headers = await this.createHeaders({
          request: {
            method: config.method,
            url: config.url,
            headers: JSON.parse(JSON.stringify(config.headers)),
            body: config.data ? JSON.stringify(config.data) : undefined,
          },
          privateKey: ed.etc.hexToBytes(privateKey),
          keyId,
        })

        if (config.data) {
          config.headers['Content-Type'] = headers['Content-Type']
          // Kept receiving console errors for setting unsafe header.
          // Keeping this as a comment for now.
          // config.headers['Content-Length'] = headers['Content-Length']
          config.headers['Content-Digest'] = headers['Content-Digest']
        }

        config.headers['Signature'] = headers['Signature']
        config.headers['Signature-Input'] = headers['Signature-Input']

        return config
      },
    })
  }
}
