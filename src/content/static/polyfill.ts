// language=JavaScript
export const wm2Polyfill = `
  const dbg = () => {
  }
  dbg('setonmonetization property start')
  const handlers = new WeakMap()
  var attributes = {
    enumerable: true,
    configurable: false,
    get() {
      return handlers.get(this) || null
    },
    set(val) {
      dbg('set onmonetization called, with', val)
      const listener = handlers.get(this)
      if (listener && listener === val) {
        // nothing to do here ?
        return
      }
      const removeAnyExisting = () => {
        if (listener) {
          dbg('removing existing listener')
          this.removeEventListener('monetization', listener)
        }
      }
      if (val == null /* OR undefined*/) {
        handlers.delete(this)
        removeAnyExisting()
      } else if (typeof val === 'function') {
        removeAnyExisting()
        this.addEventListener('monetization', val)
        handlers.set(this, val)
      } else {
        throw new Error("val must be a function, got " + typeof val)
      }
    }
  }

  const supportsOriginal = DOMTokenList.prototype.supports
  const supportsMonetization = Symbol.for('link-supports-monetization')
  DOMTokenList.prototype.supports = function(token) {
    if (this[supportsMonetization] && token === 'monetization') {
      return true
    } else {
      return supportsOriginal.call(this, token)
    }
  }

  const relList = Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'relList')
  const relListGetOriginal = relList.get

  relList.get = function() {
    const val = relListGetOriginal.call(this)
    val[supportsMonetization] = true
    return val
  }

  Object.defineProperty(HTMLLinkElement.prototype, 'relList', relList)
  Object.defineProperty(HTMLElement.prototype, 'onmonetization', attributes)
  Object.defineProperty(Window.prototype, 'onmonetization', attributes)
  Object.defineProperty(Document.prototype, 'onmonetization', attributes)
  dbg('setonmonetization property end')
  dbg('add coil-onmonetization-v2-attr-changed handler start')

  //
  class MonetizationEvent extends Event {
    constructor(type, details) {
      super('monetization', { bubbles: true })
      Object.assign(this, details)
    }

    get [Symbol.toStringTag]() {
      return 'MonetizationEvent'
    }
  }

  window.MonetizationEvent = MonetizationEvent

  window.addEventListener('monetization-v2', (event) => {
    dbg(
      'monetization-v2 event'
    )

    const monetizationTag = document.querySelector('link[rel="monetization"]');
    const monetizationEvent = new MonetizationEvent('monetization', event.detail)
    monetizationTag.dispatchEvent(monetizationEvent)
  }, { capture: true, bubble: true })
  window.addEventListener('onmonetization-attr-changed', (event) => {
    dbg('onmonetization-attr-changed', event.detail.attribute)
    const { attribute } = event.detail
    if (attribute) {
      // TODO:WM2 what are the CSP issues here?
      // is there any alternative ??
      // Well, people could just use
      event.target.onmonetization = new Function(attribute).bind(event.target)
    } else {
      event.target.onmonetization = null
    }
  }, { capture: true })
  dbg('add coil-onmonetization-v2-attr-changed handler end')
`
