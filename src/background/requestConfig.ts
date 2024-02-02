import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { signMessage } from 'http-message-signatures/lib/httpbis'
import { createContentDigestHeader } from 'httpbis-digest-headers'

interface ContentHeaders {
  'Content-Digest': string
  'Content-Length': string
  'Content-Type': string
}

function createMySigner(privateKey: CryptoKey, keyId: string) {
  return {
    id: keyId,
    alg: 'ed25519',
    async sign(data: BufferSource) {
      return Buffer.from(await crypto.subtle.sign('ed25519', privateKey, data))
    },
  }
}

async function importPrivateKey(privateKey: JsonWebKey): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'jwk',
    privateKey,
    {
      name: 'Ed25519',
    },
    true,
    ['sign'],
  )
}

async function getPrivateKey(): Promise<{ privateKey: JsonWebKey; keyId: string }> {
  return new Promise(res => {
    chrome.storage.local.get(['privateKey', 'keyId'], v => {
      res({
        privateKey: v.privateKey,
        keyId: v.keyId,
      })
    })
  })
}

function createContentHeaders(body: string): ContentHeaders {
  return {
    'Content-Digest': createContentDigestHeader(JSON.stringify(JSON.parse(body)), ['sha-512']),
    'Content-Length': Buffer.from(body as string, 'utf-8').length.toString(),
    'Content-Type': 'application/json',
  }
}

export const getAxiosInstance = (timeout = 10000): AxiosInstance => {
  const axiosInstance = axios.create({
    withCredentials: false,
    headers: {
      Accept: 'application/json',
    },
    timeout,
  })

  axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      if (!config.method || !config.url) {
        throw new Error('Cannot intercept request: url or method missing')
      }
      const { privateKey, keyId } = await getPrivateKey()
      const importedPrivateKey = await importPrivateKey(privateKey)

      const headers = {
        ...config.headers,
      }

      const request = {
        method: config.method.toUpperCase(),
        url: config.url,
        headers: JSON.parse(JSON.stringify(headers)),
        body: config.data ? JSON.stringify(config.data) : undefined,
      }

      if (request.body) {
        request.headers = {
          ...request.headers,
          ...createContentHeaders(request.body),
        }
      }

      const createSignatureHeaders = async () => {
        const components = ['@method', '@target-uri']
        if (request.headers['Authorization'] || request.headers['authorization']) {
          components.push('authorization')
        }

        if (request.body) {
          components.push('content-digest', 'content-length', 'content-type')
        }
        const key = createMySigner(importedPrivateKey, keyId)

        const signedRequest = await signMessage(
          {
            name: 'sig1',
            params: ['alg', 'keyid', 'created'],
            fields: components,
            key,
          },
          request,
        )

        return signedRequest
      }

      const signedHeaders = await createSignatureHeaders()

      config.headers['Signature'] = signedHeaders.headers['Signature']
      config.headers['Signature-Input'] = signedHeaders.headers['Signature-Input']

      config.headers = {
        ...request.headers,
        ...signedHeaders.headers,
      }

      return config
    },
    undefined,
    {
      runWhen: (config: InternalAxiosRequestConfig) =>
        config.method?.toLowerCase() === 'post' ||
        !!(config.headers && config.headers['Authorization']),
    },
  )

  return axiosInstance
}
