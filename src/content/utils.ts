export class PaymentEndpointError extends Error {}

export function checkWalletAddressUrlFormat(
  pointerOrUrl: string,
  urlOnly = false
) {
  const httpUrl = urlOnly
    ? pointerOrUrl
    : pointerOrUrl.replace(/^\$/, 'https://')

  let url: URL
  try {
    url = new URL(httpUrl)
    if (!url.protocol.match(/https?:/)) {
      const spec = urlOnly ? '' : 'either a payment pointer or '
      // noinspection ExceptionCaughtLocallyJS
      throw new PaymentEndpointError(
        `SPSP endpoint must be specified as ${spec}fully resolved https:// url, ` +
          `got ${JSON.stringify(pointerOrUrl)} `
      )
    }
  } catch (e) {
    if (e instanceof PaymentEndpointError) {
      throw e
    } else {
      throw new PaymentEndpointError(
        `Invalid payment pointer/url: ${JSON.stringify(pointerOrUrl)}`
      )
    }
  }

  const isPaymentPointer = pointerOrUrl.startsWith('$')

  if (
    isPaymentPointer &&
    (url.hash || url.search || url.port || url.username || url.password)
  ) {
    throw new PaymentEndpointError(
      'Payment pointer must not contain ' +
        'query/fragment/port/username/password elements: ' +
        JSON.stringify({
          hash: url.hash,
          search: url.search,
          port: url.port,
          username: url.username,
          password: url.password
        })
    )
  }
  return isPaymentPointer && url.pathname === '/'
    ? url.href + '.well-known/pay'
    : url.href
}

type DefaultView = WindowProxy & typeof globalThis
type CloneInto = (obj: unknown, _window: DefaultView | null) => typeof obj
declare const cloneInto: CloneInto | undefined

let cloneIntoRef: CloneInto | undefined
try {
  cloneIntoRef = cloneInto
} catch (e) {
  cloneIntoRef = undefined
}

export function mozClone(obj: unknown, document: Document) {
  return cloneIntoRef ? cloneIntoRef(obj, document.defaultView) : obj
}

export class CustomError extends Error {
  constructor(message?: string) {
    // 'Error' breaks prototype chain here
    super(message)

    // restore prototype chain
    const actualProto = new.target.prototype

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(this as any).__proto__ = actualProto
    }
  }
}
