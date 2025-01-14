import type { MonetizationEventPayload } from '@/shared/messages';
(() => {
  if (document.createElement('link').relList.supports('monetization')) {
    // already patched
    return;
  }

  const handlers = new WeakMap();
  const attributes: PropertyDescriptor & ThisType<EventTarget> = {
    enumerable: true,
    configurable: false,
    get() {
      return handlers.get(this) || null;
    },
    set(val) {
      const listener = handlers.get(this);
      if (listener && listener === val) {
        // nothing to do here ?
        return;
      }
      const removeAnyExisting = () => {
        if (listener) {
          this.removeEventListener('monetization', listener);
        }
      };
      if (val == null /* OR undefined*/) {
        handlers.delete(this);
        removeAnyExisting();
      } else if (typeof val === 'function') {
        removeAnyExisting();
        this.addEventListener('monetization', val);
        handlers.set(this, val);
      } else {
        throw new Error(`val must be a function, got ${typeof val}`);
      }
    },
  };

  const supportsOriginal = DOMTokenList.prototype.supports;
  const supportsMonetization = Symbol.for('link-supports-monetization');
  DOMTokenList.prototype.supports = function (token) {
    // @ts-expect-error: polyfilled
    if (this[supportsMonetization] && token === 'monetization') {
      return true;
    } else {
      return supportsOriginal.call(this, token);
    }
  };

  const relList = Object.getOwnPropertyDescriptor(
    HTMLLinkElement.prototype,
    'relList',
  )!;
  const relListGetOriginal = relList.get!;

  relList.get = function () {
    const val = relListGetOriginal.call(this);
    val[supportsMonetization] = true;
    return val;
  };

  Object.defineProperty(HTMLLinkElement.prototype, 'relList', relList);
  Object.defineProperty(HTMLElement.prototype, 'onmonetization', attributes);
  Object.defineProperty(Window.prototype, 'onmonetization', attributes);
  Object.defineProperty(Document.prototype, 'onmonetization', attributes);

  let eventDetailDeprecationEmitted = false;
  class MonetizationEvent extends Event {
    public readonly amountSent: PaymentCurrencyAmount;
    public readonly incomingPayment: string;
    public readonly paymentPointer: string;

    constructor(
      type: 'monetization',
      eventInitDict: MonetizationEventPayload['details'],
    ) {
      super(type, { bubbles: true });
      const { amountSent, incomingPayment, paymentPointer } = eventInitDict;
      this.amountSent = amountSent;
      this.incomingPayment = incomingPayment;
      this.paymentPointer = paymentPointer;
    }

    get [Symbol.toStringTag]() {
      return 'MonetizationEvent';
    }

    get detail() {
      if (!eventDetailDeprecationEmitted) {
        const msg =
          'MonetizationEvent.detail is deprecated. Access attributes directly instead.';
        // biome-ignore lint/suspicious/noConsole: warning meant for website devs
        console.warn(msg);
        eventDetailDeprecationEmitted = true;
      }
      const { amountSent, incomingPayment, paymentPointer } = this;
      return { amountSent, incomingPayment, paymentPointer };
    }
  }

  // @ts-expect-error: we're defining this now
  window.MonetizationEvent = MonetizationEvent;

  window.addEventListener(
    '__wm_ext_monetization',
    (event: CustomEvent<MonetizationEventPayload['details']>) => {
      if (!(event.target instanceof HTMLLinkElement)) return;
      if (!event.target.isConnected) return;

      const monetizationTag = event.target;
      monetizationTag.dispatchEvent(
        new MonetizationEvent('monetization', event.detail),
      );
    },
    { capture: true },
  );

  window.addEventListener(
    '__wm_ext_onmonetization_attr_change',
    (event: CustomEvent<{ attribute?: string }>) => {
      if (!event.target) return;

      const { attribute } = event.detail;
      // @ts-expect-error: we're defining this now
      event.target.onmonetization = attribute
        ? new Function(attribute).bind(event.target)
        : null;
    },
    { capture: true },
  );
})();
