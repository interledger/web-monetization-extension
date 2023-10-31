import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

export const getAxiosInstance = (
  keyId: string,
  privateKey: string,
  timeout = 10000,
): AxiosInstance => {
  const axiosInstance = axios.create({
    headers: {
      common: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    timeout,
  })

  axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      if (!config.method || !config.url) {
        throw new Error('Cannot intercept request: url or method missing')
      }

      const payload = {
        keyId,
        base64Key: privateKey,
        request: {
          headers: {
            host: new URL(config.url).host,
            ...config.headers,
          },
          method: config.method.toUpperCase(),
          url: config.url,
        },
        body: JSON.stringify(config.data),
      }

      const contentAndSigHeaders = await axios.post(
        'https://kxu5d4mr4blcthphxomjlc4xk40rvdsx.lambda-url.eu-central-1.on.aws/', // @TODO secure lambda url
        payload,
        { headers: { 'Content-Type': 'application/json' } },
      )

      config.headers['Signature'] = contentAndSigHeaders.data['Signature']
      config.headers['Signature-Input'] = contentAndSigHeaders.data['Signature-Input']
      config.headers['Content-Digest'] = contentAndSigHeaders.data['Content-Digest']

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
