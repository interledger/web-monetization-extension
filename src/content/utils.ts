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

export function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)));
}
