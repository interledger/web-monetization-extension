export class WalletAddressFormatError extends Error {}

export function checkWalletAddressUrlFormat(walletAddressUrl: string): void {
  let url: URL
  try {
    url = new URL(walletAddressUrl)
    if (url.protocol !== 'https:') {
      throw new WalletAddressFormatError(
        `Wallet address URL must be specified as a fully resolved https:// url, ` +
          `got ${JSON.stringify(walletAddressUrl)} `
      )
    }
  } catch (e) {
    if (e instanceof WalletAddressFormatError) {
      throw e
    } else {
      throw new WalletAddressFormatError(
        `Invalid wallet address URL: ${JSON.stringify(walletAddressUrl)}`
      )
    }
  }

  const { hash, search, port, username, password } = url

  if (hash || search || port || username || password) {
    throw new WalletAddressFormatError(
      `Wallet address URL must not contain query/fragment/port/username/password elements. Received: ${JSON.stringify({ hash, search, port, username, password })}`
    )
  }
}

type DefaultView = WindowProxy & typeof globalThis
type CloneInto = (obj: unknown, _window: DefaultView | null) => typeof obj
declare const cloneInto: CloneInto | undefined

let cloneIntoRef: CloneInto | undefined
try {
  cloneIntoRef = cloneInto
} catch {
  cloneIntoRef = undefined
}

export function mozClone<T = unknown>(obj: T, document: Document) {
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
