import { isNotNull } from '@/shared/helpers';
import { mozClone, setDifference, WalletAddressFormatError } from '../utils';
import type {
  MonetizationEventPayload,
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StartMonetizationPayloadEntry,
  StopMonetizationPayload,
  StopMonetizationPayloadEntry,
} from '@/shared/messages';
import type { Cradle as _Cradle } from '@/content/container';
import type { ContentToContentMessage } from '../messages';

type Cradle = Pick<_Cradle, 'document' | 'logger' | 'message' | 'global'>;

export class MonetizationLinkManager {
  private global: Cradle['global'];
  private window: Window;
  private document: Cradle['document'];
  private logger: Cradle['logger'];
  private message: Cradle['message'];

  private isTopFrame: boolean;
  private isFirstLevelFrame: boolean;
  private documentObserver: MutationObserver;
  private monetizationLinkAttrObserver: MutationObserver;
  private id: string;
  private monetizationLinks = new Map<
    HTMLLinkElement,
    StartMonetizationPayloadEntry
  >();
  private pendingValidationLinks = new WeakSet<HTMLLinkElement>();

  constructor({ document, logger, message, global }: Cradle) {
    Object.assign(this, {
      global,
      document,
      logger,
      message,
      window: global.window,
    });
    const { MutationObserver, crypto, window } = this.global;

    this.id = crypto.randomUUID();
    this.isTopFrame = window === window.top;
    this.isFirstLevelFrame = window.parent === window.top;

    this.documentObserver = new MutationObserver((records) =>
      this.onWholeDocumentObserved(records),
    );

    this.monetizationLinkAttrObserver = new MutationObserver((records) =>
      this.onLinkAttrChange(records),
    );
  }

  start(): void {
    const isDocumentReady = () => {
      const doc = this.document;
      return (
        (doc.readyState === 'interactive' || doc.readyState === 'complete') &&
        doc.visibilityState === 'visible'
      );
    };

    if (isDocumentReady()) {
      void this.run();
      return;
    }

    document.addEventListener(
      'readystatechange',
      () => {
        if (isDocumentReady()) {
          void this.run();
        } else {
          document.addEventListener(
            'visibilitychange',
            () => {
              if (isDocumentReady()) {
                void this.run();
              }
            },
            { once: true },
          );
        }
      },
      { once: true },
    );
  }

  end() {
    this.documentObserver.disconnect();
    this.monetizationLinkAttrObserver.disconnect();
    this.monetizationLinks.clear();
    this.document.removeEventListener(
      'visibilitychange',
      this.onDocumentVisibilityChange,
    );
    this.window.removeEventListener('message', this.onWindowMessage);
    this.window.removeEventListener('focus', this.onFocus);
    this.window.removeEventListener('pagehide', this.onPageHide);
  }

  /**
   * Check if iframe or not
   */
  private async run() {
    this.document.addEventListener(
      'visibilitychange',
      this.onDocumentVisibilityChange,
    );
    this.onFocus();
    this.window.addEventListener('focus', this.onFocus);
    this.window.addEventListener('pagehide', this.onPageHide);

    if (!this.isTopFrame && this.isFirstLevelFrame) {
      this.window.addEventListener('message', this.onWindowMessage);
      this.postMessage('INITIALIZE_IFRAME', undefined);
    }

    const nodesWithOnMonetization =
      this.document.querySelectorAll<HTMLElement>('[onmonetization]');
    for (const node of nodesWithOnMonetization) {
      this.dispatchOnMonetizationAttrChangedEvent(node);
    }

    this.documentObserver.observe(this.document, {
      subtree: true,
      childList: true,
      attributeFilter: ['onmonetization'],
    });

    const monetizationLinks = this.getMonetizationLinkTags();

    if (this.isTopFrame) {
      const validLinks = (
        await Promise.all(
          [...monetizationLinks].map((elem) => this.onAddedLink(elem)),
        )
      ).filter(isNotNull);
      await this.sendStartMonetization(validLinks);
    } else {
      await this.sendIframeStartMonetization([...monetizationLinks]);
    }
  }

  private onWindowMessage = (event: MessageEvent<ContentToContentMessage>) => {
    const { message, id, payload } = event.data;

    if (event.origin === window.location.href || id !== this.id) return;

    switch (message) {
      case 'START_MONETIZATION':
        return void this.message.send('START_MONETIZATION', payload);
      case 'RESUME_MONETIZATION':
        return void this.message.send('RESUME_MONETIZATION', payload);
      default:
        return;
    }
  };

  private getMonetizationLinkTags(root?: HTMLElement): Set<HTMLLinkElement> {
    if (this.isTopFrame) {
      const parentNode = root ?? this.document;
      return new Set(
        parentNode.querySelectorAll<HTMLLinkElement>(
          'link[rel="monetization"]',
        ),
      );
    } else {
      if (root && !root.closest('head')) {
        return new Set();
      }

      const frameMonetizationTags =
        this.document.querySelectorAll<HTMLLinkElement>(
          'head link[rel="monetization"]',
        );
      return new Set(frameMonetizationTags);
    }
  }

  /** @throws never throws */
  private async checkLink(link: HTMLLinkElement) {
    const { HTMLLinkElement } = this.global;
    if (!(link instanceof HTMLLinkElement && link.rel === 'monetization')) {
      return null;
    }
    if (link.hasAttribute('disabled')) {
      return null;
    }

    const walletAddress = await this.validateLink(link);
    if (!walletAddress) {
      return null;
    }

    return walletAddress;
  }

  /** @throws never throws */
  private async validateLink(
    link: HTMLLinkElement,
  ): Promise<StartMonetizationPayloadEntry | null> {
    const walletAddressUrl = link.href.trim();
    const { crypto } = this.global;
    try {
      this.checkHrefFormat(walletAddressUrl);
      const response = await this.message.send('GET_WALLET_ADDRESS_INFO', {
        walletAddressUrl,
      });

      if (response.success === false) {
        throw new Error(
          `Could not retrieve wallet address information for ${JSON.stringify(walletAddressUrl)}.`,
        );
      }
      const walletAddress = response.payload;
      if (!walletAddress) {
        return null;
      }

      this.dispatchLoadEvent(link);
      return {
        walletAddress,
        requestId: crypto.randomUUID(),
      };
    } catch (e) {
      this.logger.error(e);
      this.dispatchErrorEvent(link);
      return null;
    }
  }

  private checkHrefFormat(href: string): void {
    let url: URL;
    try {
      url = new URL(href);
      if (url.protocol !== 'https:') {
        throw new WalletAddressFormatError(
          `Wallet address URL must be specified as a fully resolved https:// url, got ${JSON.stringify(href)} `,
        );
      }
    } catch (e) {
      if (e instanceof WalletAddressFormatError) {
        throw e;
      }
      throw new WalletAddressFormatError(
        `Invalid wallet address URL: ${JSON.stringify(href)}`,
      );
    }

    const { hash, search, port, username, password } = url;

    if (hash || search || port || username || password) {
      throw new WalletAddressFormatError(
        `Wallet address URL must not contain query/fragment/port/username/password elements. Received: ${JSON.stringify({ hash, search, port, username, password })}`,
      );
    }
  }

  private observeLinkAttrs(link: HTMLLinkElement) {
    this.monetizationLinkAttrObserver.observe(link, {
      childList: false,
      attributeOldValue: true,
      attributeFilter: ['href', 'disabled', 'rel', 'crossorigin', 'type'],
    });
  }

  private dispatchLoadEvent(tag: HTMLLinkElement) {
    tag.dispatchEvent(new this.global.Event('load'));
  }

  private dispatchErrorEvent(tag: HTMLLinkElement) {
    tag.dispatchEvent(new this.global.Event('error'));
  }

  public dispatchMonetizationEvent({
    requestId,
    details,
  }: MonetizationEventPayload) {
    for (const [tag, tagDetails] of this.monetizationLinks.entries()) {
      if (tagDetails.requestId !== requestId) continue;

      tag.dispatchEvent(
        new CustomEvent('__wm_ext_monetization', {
          detail: mozClone(details, this.document),
          bubbles: true,
        }),
      );
      break;
    }
  }

  private dispatchOnMonetizationAttrChangedEvent(
    node: HTMLElement,
    { changeDetected = false } = {},
  ) {
    const { CustomEvent } = this.global;
    const attribute = node.getAttribute('onmonetization');
    if (!attribute && !changeDetected) return;

    const customEvent = new CustomEvent('__wm_ext_onmonetization_attr_change', {
      bubbles: true,
      detail: mozClone({ attribute }, this.document),
    });
    node.dispatchEvent(customEvent);
  }

  private async stopMonetization(
    intent?: StopMonetizationPayloadEntry['intent'],
  ) {
    const payload: StopMonetizationPayload = [
      ...this.monetizationLinks.values(),
    ]
      .filter(isNotNull)
      .map(({ requestId }) => ({ requestId, intent }));

    await this.sendStopMonetization(payload);
  }

  public async resumeMonetization() {
    const payload: ResumeMonetizationPayload = [
      ...this.monetizationLinks.values(),
    ].map(({ requestId, walletAddress }) => ({ requestId, walletAddress }));

    await this.sendResumeMonetization(payload);
  }

  private async sendStartMonetization(
    payload: StartMonetizationPayload,
    onlyToTopIframe = false,
  ) {
    if (!payload.length) return;

    if (this.isTopFrame) {
      await this.message.send('START_MONETIZATION', payload);
    } else if (this.isFirstLevelFrame && !onlyToTopIframe) {
      this.postMessage('IS_MONETIZATION_ALLOWED_ON_START', payload);
    }
  }

  private async sendIframeStartMonetization(linkTagsNow: HTMLLinkElement[]) {
    for (const link of linkTagsNow) {
      const validLink = await this.onAddedLink(link);
      if (validLink) {
        // found first valid link - use it and stop checking others
        await this.sendStartMonetization([validLink]);
        break;
      }
    }
  }

  private async sendStopMonetization(payload: StopMonetizationPayload) {
    if (!payload.length) return;
    await this.message.send('STOP_MONETIZATION', payload);
  }

  private async sendResumeMonetization(
    payload: ResumeMonetizationPayload,
    onlyToTopIframe = false,
  ) {
    if (!payload.length) return;

    if (this.isTopFrame) {
      await this.message.send('RESUME_MONETIZATION', payload);
    } else if (this.isFirstLevelFrame && !onlyToTopIframe) {
      this.postMessage('IS_MONETIZATION_ALLOWED_ON_RESUME', payload);
    }
  }

  private onDocumentVisibilityChange = async () => {
    if (this.document.visibilityState === 'visible') {
      await this.resumeMonetization();
    } else {
      await this.stopMonetization();
    }
  };

  private onFocus = async () => {
    if (this.document.hasFocus()) {
      await this.message.send('TAB_FOCUSED');
    }
  };

  private onPageHide = async () => {
    await this.stopMonetization('remove');
  };

  private async onWholeDocumentObserved(records: MutationRecord[]) {
    const { HTMLElement } = this.global;

    for (const record of records) {
      if (
        record.type === 'attributes' &&
        record.target instanceof HTMLElement &&
        record.attributeName === 'onmonetization'
      ) {
        this.dispatchOnMonetizationAttrChangedEvent(record.target, {
          changeDetected: true,
        });
      }
    }

    if (!this.isTopFrame && !this.isFirstLevelFrame) {
      return;
    }

    const previousLinks = new Set(this.monetizationLinks.keys());
    const linkTagsNow = this.getMonetizationLinkTags();

    // handle removed links first
    const tagsRemoved = setDifference(previousLinks, linkTagsNow);
    const stopMonetizationPayload = await Promise.all(
      [...tagsRemoved].map((tag) => this.onRemovedLink(tag)),
    );
    await this.sendStopMonetization(stopMonetizationPayload.filter(isNotNull));

    // then handle new added links
    if (!this.isTopFrame) {
      await this.validateFrameMonetization([...linkTagsNow]);
    } else {
      const tagsAdded = setDifference(linkTagsNow, previousLinks);
      const validLinks = await Promise.all(
        [...tagsAdded].map((link) => this.onAddedLink(link)),
      );
      await this.sendStartMonetization(validLinks.filter(isNotNull));
    }
  }

  private async validateFrameMonetization(
    linkTags: HTMLLinkElement[],
  ): Promise<void> {
    if (this.monetizationLinks.has(linkTags[0])) {
      // the first link is already the valid one
      return;
    }

    //if not, stop the current monetization and find the first valid link
    const frameTagRemoved = await Promise.all(
      [...this.monetizationLinks.keys()].map((tag) =>
        this.onRemovedLink(tag, 'disable'),
      ),
    );
    await this.sendStopMonetization(frameTagRemoved);

    await this.sendIframeStartMonetization(linkTags);
  }

  private postMessage<K extends ContentToContentMessage['message']>(
    message: K,
    payload: Extract<ContentToContentMessage, { message: K }>['payload'],
  ) {
    this.window.parent.postMessage({ message, id: this.id, payload }, '*');
  }

  // For iframes, need to re-evaluate all links when attributes change
  // Current link is no longer valid - stop it and try to find new valid link
  // Try to find and validate next available link
  private async onLinkAttrChange(records: MutationRecord[]) {
    const { HTMLLinkElement } = this.global;
    const handledTags = new Set<Node>();
    const startMonetizationPayload: StartMonetizationPayload = [];
    const stopMonetizationPayload: StopMonetizationPayload = [];

    // Check for a non specified link with the type now specified and
    // just treat it as a newly seen, monetization tag
    for (const record of records) {
      const target = record.target as HTMLLinkElement;
      if (handledTags.has(target)) {
        continue;
      }

      const hasTarget = this.monetizationLinks.has(target);
      const linkRelSpecified =
        target instanceof HTMLLinkElement && target.rel === 'monetization';
      // this will also handle the case of a @disabled tag that
      // is not tracked, becoming enabled
      if (!hasTarget && linkRelSpecified) {
        const payloadEntry = await this.onAddedLink(target);
        if (payloadEntry) {
          startMonetizationPayload.push(payloadEntry);
        }
        handledTags.add(target);
      } else if (hasTarget && !linkRelSpecified) {
        const payloadEntry = this.onRemovedLink(target);
        stopMonetizationPayload.push(payloadEntry);
        handledTags.add(target);
      } else if (!hasTarget && !linkRelSpecified) {
        // ignore these changes
        handledTags.add(target);
      } else if (hasTarget && linkRelSpecified) {
        if (
          record.type === 'attributes' &&
          record.attributeName === 'disabled' &&
          target instanceof HTMLLinkElement &&
          target.getAttribute('disabled') !== record.oldValue
        ) {
          const wasDisabled = record.oldValue !== null;
          const isDisabled = target.hasAttribute('disabled');
          if (wasDisabled !== isDisabled) {
            try {
              const payloadEntry = this.monetizationLinks.get(target);
              if (!payloadEntry) {
                throw new Error(
                  'Could not find wallet address for monetization node',
                );
              }
              if (isDisabled) {
                stopMonetizationPayload.push({
                  requestId: payloadEntry.requestId,
                  intent: 'disable',
                });
              } else {
                startMonetizationPayload.push(payloadEntry);
              }
            } catch {
              // if we can't find existing entry, try to revalidate
              const payloadEntry = await this.checkLink(target);
              if (payloadEntry) {
                this.monetizationLinks.set(target, payloadEntry);
                startMonetizationPayload.push(payloadEntry);
              }
            }
            handledTags.add(target);
          }
        } else if (
          record.type === 'attributes' &&
          record.attributeName === 'href' &&
          target instanceof HTMLLinkElement &&
          target.href !== record.oldValue
        ) {
          if (this.monetizationLinks.has(target)) {
            // stop existing monetization first
            try {
              const removedEntry = this.onRemovedLink(target);
              stopMonetizationPayload.push(removedEntry);
            } catch (e) {
              this.logger.error(e);
            }
          }

          // then validate with new href
          if (this.isTopFrame) {
            const payloadEntry = await this.validateLink(target);
            if (payloadEntry) {
              this.monetizationLinks.set(target, payloadEntry);
              startMonetizationPayload.push(payloadEntry);
              this.observeLinkAttrs(target);
            }
          }
          handledTags.add(target);
        }
      }
    }

    await this.sendStopMonetization(stopMonetizationPayload);
    if (!this.isTopFrame) {
      // in iframes, validate all links to find first valid one
      const linkTagsNow = this.getMonetizationLinkTags();
      void this.sendIframeStartMonetization([...linkTagsNow]);
    } else {
      void this.sendStartMonetization(startMonetizationPayload);
    }
  }

  private async onAddedLink(
    link: HTMLLinkElement,
  ): Promise<StartMonetizationPayloadEntry | null> {
    if (
      // if link is already being validated, do not check same link again
      this.pendingValidationLinks.has(link) ||
      this.monetizationLinks.has(link)
    ) {
      return null;
    }

    this.pendingValidationLinks.add(link);

    const walletAddress = await this.checkLink(link);
    if (!walletAddress) {
      return null;
    }

    this.monetizationLinks.set(link, walletAddress);
    // if link validation failed, do not remove it from pending validation links
    this.pendingValidationLinks.delete(link);
    this.observeLinkAttrs(link);

    return walletAddress;
  }

  private onRemovedLink(
    link: HTMLLinkElement,
    intent: StopMonetizationPayloadEntry['intent'] = 'remove',
  ): StopMonetizationPayloadEntry {
    const details = this.monetizationLinks.get(link);
    if (!details) {
      throw new Error(
        `Could not find wallet address for monetization node ${link.outerHTML.slice(0, 200)}`,
      );
    }
    this.monetizationLinks.delete(link);

    return { requestId: details.requestId, intent };
  }
}
