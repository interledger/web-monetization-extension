import { isNotNull } from '@/shared/helpers';
import { mozClone, WalletAddressFormatError } from '../utils';
import type { WalletAddress } from '@interledger/open-payments/dist/types';
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
  // only entries corresponding to valid wallet addresses are here
  private monetizationLinks = new Map<
    HTMLLinkElement,
    { walletAddress: WalletAddress; requestId: string }
  >();

  constructor({ document, logger, message, global }: Cradle) {
    Object.assign(this, {
      global,
      document,
      logger,
      message,
      window: global.window,
    });

    this.documentObserver = new this.global.MutationObserver((records) =>
      this.onWholeDocumentObserved(records),
    );

    this.monetizationLinkAttrObserver = new this.global.MutationObserver(
      (records) => this.onLinkAttrChange(records),
    );

    this.isTopFrame = this.window === this.window.top;
    this.isFirstLevelFrame = this.window.parent === this.window.top;
    this.id = crypto.randomUUID();
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

    for (const link of monetizationLinks) {
      this.observeLinkAttrs(link);
    }

    const validLinks = (
      await Promise.all(monetizationLinks.map((elem) => this.checkLink(elem)))
    ).filter(isNotNull);

    for (const { link, details } of validLinks) {
      this.monetizationLinks.set(link, details);
    }

    await this.sendStartMonetization(validLinks.map((e) => e.details));
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

  private getMonetizationLinkTags(root?: HTMLElement): HTMLLinkElement[] {
    if (this.isTopFrame) {
      const parentNode = root ?? this.document;
      return Array.from(
        parentNode.querySelectorAll<HTMLLinkElement>(
          'link[rel="monetization"]',
        ),
      );
    } else {
      if (root && !root.closest('head')) {
        return [];
      }
      const monetizationTag = this.document.querySelector<HTMLLinkElement>(
        'head link[rel="monetization"]',
      );
      return monetizationTag ? [monetizationTag] : [];
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

    return {
      link,
      details: {
        requestId: crypto.randomUUID(),
        walletAddress: walletAddress,
      },
    };
  }

  /** @throws never throws */
  private async validateLink(
    link: HTMLLinkElement,
  ): Promise<WalletAddress | null> {
    const walletAddressUrl = link.href.trim();
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

      this.dispatchLoadEvent(link);
      return response.payload;
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
    for (const [tag, tagDetails] of this.monetizationLinks) {
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
    ].map(({ requestId }) => ({ requestId, intent }));

    await this.sendStopMonetization(payload);
  }

  private async resumeMonetization() {
    const payload: ResumeMonetizationPayload = [
      ...this.monetizationLinks.values(),
    ].map(({ requestId }) => ({ requestId }));

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

    const childListRecords = records.filter((e) => e.type === 'childList');
    const removedNodes = childListRecords.flatMap((e) => [...e.removedNodes]);
    const allRemovedLinkTags = removedNodes.map((node) =>
      this.onRemovedNode(node),
    );
    const stopMonetizationPayload: StopMonetizationPayload = allRemovedLinkTags
      .filter(isNotNull)
      .flat();
    await this.sendStopMonetization(stopMonetizationPayload);

    if (this.isTopFrame) {
      const addedNodes = childListRecords.flatMap((e) => [...e.addedNodes]);
      const allAddedLinkTags = await Promise.all(
        addedNodes.map((node) => this.onAddedNode(node)),
      );
      const startMonetizationPayload = allAddedLinkTags
        .filter(isNotNull)
        .flat();

      void this.sendStartMonetization(startMonetizationPayload);
    }

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
  }

  private postMessage<K extends ContentToContentMessage['message']>(
    message: K,
    payload: Extract<ContentToContentMessage, { message: K }>['payload'],
  ) {
    this.window.parent.postMessage({ message, id: this.id, payload }, '*');
  }

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
        const payloadEntry = await this.checkLink(target);
        if (payloadEntry) {
          this.monetizationLinks.set(target, payloadEntry.details);
          startMonetizationPayload.push(payloadEntry.details);
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
              const details = this.monetizationLinks.get(target);
              if (!details) {
                throw new Error('Could not find details for monetization node');
              }
              if (isDisabled) {
                stopMonetizationPayload.push({
                  requestId: details.requestId,
                  intent: 'disable',
                });
              } else {
                startMonetizationPayload.push(details);
              }
            } catch {
              const payloadEntry = await this.checkLink(target);
              if (payloadEntry) {
                this.monetizationLinks.set(target, payloadEntry.details);
                startMonetizationPayload.push(payloadEntry.details);
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
          stopMonetizationPayload.push(this.onRemovedLink(target));
          const payloadEntry = await this.checkLink(target);
          if (payloadEntry) {
            startMonetizationPayload.push(payloadEntry.details);
          }
          handledTags.add(target);
        }
      }
    }

    await this.sendStopMonetization(stopMonetizationPayload);
    void this.sendStartMonetization(startMonetizationPayload);
  }

  private async onAddedNode(
    node: Node,
  ): Promise<StartMonetizationPayload | null> {
    const { HTMLElement, HTMLLinkElement } = this.global;

    if (node instanceof HTMLElement) {
      this.dispatchOnMonetizationAttrChangedEvent(node);
    }

    if (node instanceof HTMLLinkElement) {
      const payloadEntry = await this.onAddedLink(node);
      return payloadEntry ? [payloadEntry] : null;
    } else if (node instanceof HTMLElement) {
      const linkElements = this.getMonetizationLinkTags(node);
      return await Promise.all(
        linkElements.map((linkElem) => this.onAddedLink(linkElem)),
      ).then((res) => res.filter(isNotNull));
    }
    return null;
  }

  private onRemovedNode(node: Node): StopMonetizationPayload | null {
    const { HTMLElement, HTMLLinkElement } = this.global;

    if (node instanceof HTMLLinkElement) {
      return [this.onRemovedLink(node)];
    } else if (node instanceof HTMLElement) {
      const linkElements = this.getMonetizationLinkTags(node).filter((el) =>
        this.monetizationLinks.has(el),
      );
      return linkElements.map((linkElem) => this.onRemovedLink(linkElem));
    }

    return null;
  }

  private async onAddedLink(
    link: HTMLLinkElement,
  ): Promise<StartMonetizationPayloadEntry | null> {
    this.observeLinkAttrs(link);
    const res = await this.checkLink(link);
    if (!res) return null;
    this.monetizationLinks.set(link, res.details);
    return res.details;
  }

  private onRemovedLink(link: HTMLLinkElement): StopMonetizationPayloadEntry {
    const details = this.monetizationLinks.get(link);
    if (!details) {
      throw new Error(
        `Could not find details for monetization node ${link.outerHTML.slice(0, 200)}`,
      );
    }

    this.monetizationLinks.delete(link);

    return { requestId: details.requestId, intent: 'remove' };
  }
}
