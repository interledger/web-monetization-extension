export class WalletAddressFormatError extends Error {}

type DefaultView = WindowProxy & typeof globalThis;
type CloneInto = (obj: unknown, _window: DefaultView | null) => typeof obj;
declare const cloneInto: CloneInto | undefined;

let cloneIntoRef: CloneInto | undefined;
try {
  cloneIntoRef = cloneInto;
} catch {
  cloneIntoRef = undefined;
}

export function mozClone<T = unknown>(obj: T, document: Document) {
  return cloneIntoRef ? cloneIntoRef(obj, document.defaultView) : obj;
}

export class CustomError extends Error {
  constructor(message?: string) {
    // 'Error' breaks prototype chain here
    super(message);

    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).__proto__ = actualProto;
    }
  }
}
