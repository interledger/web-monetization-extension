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
