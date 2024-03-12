/* eslint-disable */
import { EventEmitter } from 'events'

import { CustomError } from './CustomError'
import { mozClone } from './mozClone'
import { resolvePaymentEndpoint } from './resolvePaymentEndpoint'
import { whenDocumentReady } from './whenDocumentReady'

const debug =
  // console.log.bind(console, 'MonetizationTagManager')
  (..._: unknown[]) => {}

export interface PaymentDetails {
  /**
   * This doesn't map 1 to 1 with a monetization tag, rather with a
   * configuration of a tag. e.g. a new href on a link will mean a new
   * requestId
   */
  requestId: string
  paymentPointer: string
  initiatingUrl: string
  fromBody: boolean
  tagType: TagType
  attrs: Record<string, string | null>
}

/**
 * On a tag removed stopped will be set
 * On a tag added started will be set
 * On a tag[content|href] changed, both will be set
 */
export interface PaymentDetailsChangeArguments {
  started: PaymentDetails | null
  stopped: PaymentDetails | null
}

export type PaymentDetailsChangeCallback = (
  _args: PaymentDetailsChangeArguments
) => void

export type MonetizationTag = HTMLMetaElement | HTMLLinkElement
export type MonetizationTagList = NodeListOf<MonetizationTag>

export type TagType = 'meta' | 'link'

export function getTagType(tag: MonetizationTag): TagType {
  return tag instanceof HTMLMetaElement ? 'meta' : 'link'
}

export class DeprecatedMetaTagIgnoredError extends CustomError {}

interface FireOnMonetizationChangeIfHaveAttributeParams {
  node: HTMLElement
  changeDetected?: boolean
}

export const metaDeprecatedMessage =
  'Web-Monetization Error: ' +
  'A `<link rel="monetization">` tag has been seen, so ' +
  'ignoring deprecated `<meta name="monetization">` tag and ' +
  'using only `<link rel="monetization">` tags consistently'

export const MonetizationTagAttrs = {
  meta: ['content', 'name'],
  link: ['href', 'disabled', 'rel', 'crossorigin', 'type']
}

const MAX_NUMBER_META_TAGS = 1

function monetizationTagTypeSpecified(
  tag: Node,
  ambiguous = false
): tag is MonetizationTag {
  if (tag instanceof HTMLLinkElement) {
    return tag.rel === 'monetization' || (ambiguous && !tag.rel)
  } else if (tag instanceof HTMLMetaElement) {
    return tag.name === 'monetization' || (ambiguous && !tag.name)
  } else {
    return false
  }
}

function nodeIsPotentiallyMonetizationTag(node: Node): node is MonetizationTag {
  return node instanceof HTMLLinkElement || node instanceof HTMLMetaElement
}

function getTagAttrs(tag: MonetizationTag, tagType: TagType) {
  return Object.fromEntries(
    MonetizationTagAttrs[tagType].map((attr) => {
      return [attr, tag.getAttribute(attr)]
    })
  )
}

export class MonetizationTagManager extends EventEmitter {
  private affinity: TagType = 'meta'
  private documentObserver: MutationObserver
  private monetizationTagAttrObserver: MutationObserver

  private monetizationTags = new Map<
    MonetizationTag,
    {
      details: PaymentDetails
    }
  >()

  private linkTagsById = new Map<string, HTMLLinkElement>()

  dispatchEventByLinkId(id: string, event: Event) {
    const link = this.linkTagsById.get(id)
    if (link) {
      debug('dispatchLinkEventByLinkId', id, event)
      link.dispatchEvent(event)
    }
  }

  requestIds(): string[] {
    return Array.from(this.monetizationTags.values()).map(
      (e) => e.details.requestId
    )
  }

  linkRequests(): PaymentDetails[] {
    return this.requests().filter((d) => d.tagType === 'link')
  }

  requests(): PaymentDetails[] {
    return Array.from(this.monetizationTags.values()).map((e) => e.details)
  }

  constructor(
    private window: Window,
    private document: Document,
    private callback: PaymentDetailsChangeCallback,
    private throwOnIllegalState = true
  ) {
    super()
    this.documentObserver = new MutationObserver((records) =>
      this._onWholeDocumentObserved(records)
    )
    this.monetizationTagAttrObserver = new MutationObserver((records) =>
      this._onMonetizationTagAttrsChange(records)
    )
  }

  /**
   * Wait until the document is ready and formed
   */
  startWhenDocumentReady(): void {
    whenDocumentReady(this.document, this._start.bind(this))
  }

  // Though this is `public`, it's not part of the public interface, so we
  // prefix this method with `_` with no `private` modifier, in order to
  // jest.spyOn it.
  _start() {
    const monetizationTags: MonetizationTagList =
      this.document.querySelectorAll('meta,link')
    monetizationTags.forEach((tag) => {
      try {
        this._observeMonetizationTagAttrs(tag)
        this.onAddedTag(tag)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
      }
    })
    const onMonetizations =
      this.document.querySelectorAll<HTMLElement>('[onmonetization]')
    onMonetizations.forEach((om) => {
      this.checkMonetizationAttr(om)
    })
    this.documentObserver.observe(this.document, {
      subtree: true,
      childList: true,
      attributeFilter: ['onmonetization']
    })
  }

  _check(op: string, node: Node) {
    debug('head node', op, node)
    if (nodeIsPotentiallyMonetizationTag(node)) {
      if (op === 'added') {
        this._observeMonetizationTagAttrs(node)
        this.onAddedTag(node)
      } else if (op === 'removed' && this.monetizationTags.has(node)) {
        this._onRemovedTag(node)
      }
    }
    if (op === 'added' && node instanceof HTMLElement) {
      this.checkMonetizationAttr(node)
    }
  }

  _checkRemoved = this._check.bind(this, 'removed')
  _checkAdded = this._check.bind(this, 'added')

  _onWholeDocumentObserved(records: MutationRecord[]) {
    debug('document mutation records.length=', records.length)

    // Explicitly remove these first
    for (const record of records) {
      debug('Record', record.type, record.target)
      if (record.type === 'childList') {
        record.removedNodes.forEach(this._checkRemoved)
      }
    }

    for (const record of records) {
      debug('Record', record.type, record.target)
      if (record.type === 'childList') {
        record.addedNodes.forEach(this._checkAdded)
      }
    }
    this.onOnMonetizationChangeObserved(records)
  }

  /**
   * This needs to handle more than one tag at a time. The changes are
   * aggregated.
   * @param records
   */
  _onMonetizationTagAttrsChange(records: MutationRecord[]) {
    const handledTags = new Set<Node>()
    // Check for a non specified link or meta with the type now specified and
    // just treat it as a newly seen, monetization tag
    for (const record of records) {
      const target = record.target as MonetizationTag
      if (handledTags.has(target)) {
        continue
      }
      const hasTarget = this.monetizationTags.has(target)
      const typeSpecified = monetizationTagTypeSpecified(target)
      // this will also handle the case of a @disabled tag that
      // is not tracked, becoming enabled
      if (!hasTarget && typeSpecified) {
        this.onAddedTag(target)
        handledTags.add(target)
      } else if (hasTarget && !typeSpecified) {
        this._onRemovedTag(target)
        handledTags.add(target)
      } else if (!hasTarget && !typeSpecified) {
        // ignore these changes
        handledTags.add(target)
      } else if (hasTarget && typeSpecified) {
        if (
          record.type === 'attributes' &&
          record.attributeName === 'disabled' &&
          target instanceof HTMLLinkElement &&
          // can't use record.target[disabled] as it's a Boolean not string
          target.getAttribute('disabled') !== record.oldValue
        ) {
          const wasDisabled = record.oldValue !== null
          const isDisabled = target.hasAttribute('disabled')
          if (wasDisabled != isDisabled) {
            this._onChangedPaymentEndpoint(target, isDisabled, wasDisabled)
            handledTags.add(target)
          }
        } else if (
          record.type === 'attributes' &&
          record.attributeName === 'content' &&
          target instanceof HTMLMetaElement &&
          target.content !== record.oldValue
        ) {
          this._onChangedPaymentEndpoint(target)
          handledTags.add(target)
        } else if (
          record.type === 'attributes' &&
          record.attributeName === 'href' &&
          target instanceof HTMLLinkElement &&
          target.href !== record.oldValue
        ) {
          this._onChangedPaymentEndpoint(target)
          handledTags.add(target)
        }
      }
    }
  }

  /**
   *
   * @param tag - HTMLLinkElement or HTMLMetaElement
   *
   * Checks tag type to set affinity - link or meta
   * Tracks link by requestId
   * Checks invariants - no meta in head
   *                   - no more than one meta
   *                   - no metas when affinity with links already set
   * Invokes this.callback unless tag is disabled
   */
  private onAddedTag(tag: MonetizationTag) {
    if (!monetizationTagTypeSpecified(tag)) {
      return
    }

    const type = getTagType(tag)

    // TODO:WM2 any other cases?
    if (type === 'link' && tag.hasAttribute('disabled')) {
      return
    }

    if (type != this.affinity) {
      if (type === 'link') {
        this.affinity = 'link'
        // @ts-ignore
        for (const tag of this.monetizationTags.keys()) {
          this._onRemovedTag(tag)
        }
      }
    }

    let started: PaymentDetails | null = this.getPaymentDetails(tag)
    if (started.fromBody && started.tagType === 'meta') {
      const error = new Error(
        'Web-Monetization Error: <meta name="monetization"> ' +
          'must be in the document head'
      )
      this.emit('illegal-state-error', error)
      if (this.throwOnIllegalState) {
        throw error
      } else {
        return
      }
    }
    if (
      started.tagType === 'meta' /*|| details.tagType === 'link'*/ &&
      this.monetizationTags.size + 1 > MAX_NUMBER_META_TAGS
    ) {
      // const error = new Error(
      //   `Web-Monetization Error: Ignoring tag with ` +
      //     `paymentPointer=${started.paymentPointer}, only ${MAX_NUMBER_META_TAGS} ` +
      //     `monetization tag[s] supported at a time. `,
      // )
      //
      // // TODO:WM2 just emit error, with existing EventEmitter semantics
      // this.emit('illegal-state-error', error)
      if (this.throwOnIllegalState) {
        // throw error
      } else {
        // TODO:WM2, but this DOES work?
        // this won't work, may need to halt completely all the way up
        // the stack
        return
      }
    }

    if (started.tagType === 'link') {
      started = this.checkStartedLinkForWellFormedness(started, tag)
    }

    if (started) {
      this.monetizationTags.set(tag, { details: started })
      this.callback({ stopped: null, started: started })
    }
  }

  _observeMonetizationTagAttrs(tag: MonetizationTag) {
    const attributeFilter = MonetizationTagAttrs[getTagType(tag)]
    this.monetizationTagAttrObserver.observe(tag, {
      childList: false,
      attributeOldValue: true,
      attributeFilter
    })
  }

  _onRemovedTag(tag: MonetizationTag) {
    const entry = this.getEntry(tag, '_onRemovedTag')
    this.monetizationTags.delete(tag)
    this.clearLinkById(entry.details)
    this.callback({ started: null, stopped: entry.details })
  }

  private getEntry(meta: MonetizationTag, caller = '') {
    const entry = this.monetizationTags.get(meta)
    if (!entry) {
      throw new Error(
        `${caller}: tag not tracked: ${meta.outerHTML.slice(0, 200)}`
      )
    }
    return entry
  }

  _onChangedPaymentEndpoint(
    tag: MonetizationTag,
    disabled = false,
    wasDisabled = false
  ) {
    const entry = this.getEntry(tag, '_onChangedPaymentEndpoint')
    const stopped = wasDisabled ? null : entry.details
    this.clearLinkById(entry.details)
    let started: PaymentDetails | null = null
    if (!disabled) {
      started = this.getPaymentDetails(tag)
      started = this.checkStartedLinkForWellFormedness(started, tag)
      if (started) {
        entry.details = started
      }
    }
    if (started || stopped) {
      this.callback({ started, stopped })
    }
  }

  private checkStartedLinkForWellFormedness(
    started: PaymentDetails,
    tag: MonetizationTag
  ) {
    let returnValue: PaymentDetails | null = started
    if (started.tagType === 'link') {
      let error: Error | null = null
      try {
        resolvePaymentEndpoint(started.paymentPointer, true)
      } catch (e) {
        error = e
        returnValue = null
      }
      if (!error && returnValue) {
        this.linkTagsById.set(started.requestId, tag as HTMLLinkElement)
      } else {
        this.emit('link-resolve-payment-endpoint-error', tag, error)
        // const event = new ErrorEvent('error', { error })
        const event = new Event('error')
        tag.dispatchEvent(event)
      }
    }
    return returnValue
  }

  private clearLinkById(stopped: PaymentDetails) {
    if (stopped.tagType === 'link') {
      this.linkTagsById.delete(stopped.requestId)
    }
  }

  private getPaymentDetails(tag: MonetizationTag): PaymentDetails {
    const tagType = getTagType(tag)
    const paymentPointer =
      tag instanceof HTMLMetaElement ? tag.content : tag.href
    return {
      attrs: getTagAttrs(tag, tagType),
      requestId: crypto.randomUUID(),
      // The payment pointer validation/resolution (./well-known/pay) is done
      // elsewhere
      paymentPointer: paymentPointer.trim(),
      initiatingUrl: this.window.location.href,
      tagType: getTagType(tag),
      fromBody: tag.parentElement != this.document.head
    }
  }

  private checkMonetizationAttr(node: HTMLElement) {
    debug('checkMonetizationAttr', node)
    this.fireOnMonetizationAttrChangedEvent({ node })
  }

  private onOnMonetizationChangeObserved(records: MutationRecord[]) {
    for (const record of records) {
      if (
        record.type === 'attributes' &&
        record.target instanceof HTMLElement &&
        record.attributeName === 'onmonetization'
      ) {
        this.fireOnMonetizationAttrChangedEvent({
          node: record.target,
          changeDetected: true
        })
      }
    }
  }

  private fireOnMonetizationAttrChangedEvent({
    node,
    changeDetected = false
  }: FireOnMonetizationChangeIfHaveAttributeParams) {
    const attribute = node.getAttribute('onmonetization')
    if (attribute || changeDetected) {
      const attributeDetail = {
        attribute
      }
      const customEvent = new CustomEvent('onmonetization-attr-changed', {
        bubbles: true,
        detail: mozClone(attributeDetail, this.document)
      })
      const result = node.dispatchEvent(customEvent)
      debug('dispatched onmonetization-attr-changed ev', result)
    }
  }

  stop() {
    this.documentObserver.disconnect()
    this.monetizationTagAttrObserver.disconnect()
    this.monetizationTags.clear()
  }

  atMostOneTagAndNoneInBody() {
    let fromBody = false
    // @ts-ignore
    for (const value of this.monetizationTags.values()) {
      if (value.details.fromBody) {
        fromBody = true
      }
    }
    return this.monetizationTags.size <= 1 && !fromBody
  }
}
