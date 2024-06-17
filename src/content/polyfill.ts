/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
;(function () {
  const handlers = new WeakMap()
  const attributes = {
    enumerable: true,
    configurable: false,
    get() {
      return handlers.get(this) || null
    },
    set(val) {
      const listener = handlers.get(this)
      if (listener && listener === val) {
        // nothing to do here ?
        return
      }
      const removeAnyExisting = () => {
        if (listener) {
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
        throw new Error('val must be a function, got ' + typeof val)
      }
    }
  }

  const supportsOriginal = DOMTokenList.prototype.supports
  const supportsMonetization = Symbol.for('link-supports-monetization')
  DOMTokenList.prototype.supports = function (token) {
    if (this[supportsMonetization] && token === 'monetization') {
      return true
    } else {
      return supportsOriginal.call(this, token)
    }
  }

  const relList = Object.getOwnPropertyDescriptor(
    HTMLLinkElement.prototype,
    'relList'
  )
  const relListGetOriginal = relList.get

  relList.get = function () {
    const val = relListGetOriginal.call(this)
    val[supportsMonetization] = true
    return val
  }

  Object.defineProperty(HTMLLinkElement.prototype, 'relList', relList)
  Object.defineProperty(HTMLElement.prototype, 'onmonetization', attributes)
  Object.defineProperty(Window.prototype, 'onmonetization', attributes)
  Object.defineProperty(Document.prototype, 'onmonetization', attributes)

  let eventDetailDeprecationEmitted = false
  class MonetizationEvent extends Event {
    constructor(details) {
      super('monetization', { bubbles: true })
      Object.assign(this, details)
    }

    get [Symbol.toStringTag]() {
      return 'MonetizationEvent'
    }

    get detail() {
      if (!eventDetailDeprecationEmitted) {
        const msg = `MonetizationEvent.detail is deprecated. Access attributes directly instead.`
        // eslint-disable-next-line no-console
        console.warn(msg)
        eventDetailDeprecationEmitted = true
      }
      const { amountSent, incomingPayment, paymentPointer } = this
      return { amountSent, incomingPayment, paymentPointer }
    }
  }

  window.MonetizationEvent = MonetizationEvent

  window.addEventListener(
    '__wm_ext_monetization',
    (event) => {
      if (!(event.target instanceof HTMLLinkElement)) return
      if (!event.target.isConnected) return

      const monetizationTag = event.target
      monetizationTag.dispatchEvent(new MonetizationEvent(event.detail))
    },
    { capture: true }
  )

  window.addEventListener(
    'onmonetization-attr-changed',
    (event) => {
      // eslint-disable-next-line no-console
      console.log('onmonetization-attr-changed', event.detail)
      const { attribute } = event.detail
      if (attribute) {
        // TODO:WM2 what are the CSP issues here?
        // is there any alternative ??
        // Well, people could just use
        event.target.onmonetization = new Function(attribute).bind(event.target)
      } else {
        event.target.onmonetization = null
      }
    },
    { capture: true }
  )
})()
