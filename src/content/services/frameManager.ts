import type { ContentToContentMessage } from '../messages';
import type { StopMonetizationPayload } from '@/shared/messages';
import type { Cradle } from '@/content/container';

const HANDLED_MESSAGES: ContentToContentMessage['message'][] = [
  'INITIALIZE_IFRAME',
  'IS_MONETIZATION_ALLOWED_ON_START',
  'IS_MONETIZATION_ALLOWED_ON_RESUME',
];

export class FrameManager {
  private window: Cradle['window'];
  private document: Cradle['document'];
  private logger: Cradle['logger'];
  private message: Cradle['message'];

  private documentObserver: MutationObserver;
  private frameAllowAttrObserver: MutationObserver;
  private frames = new Map<
    HTMLIFrameElement,
    { frameId: string | null; requestIds: string[] }
  >();

  constructor({ window, document, logger, message }: Cradle) {
    Object.assign(this, {
      window,
      document,
      logger,
      message,
    });

    this.documentObserver = new MutationObserver((records) =>
      this.onWholeDocumentObserved(records),
    );

    this.frameAllowAttrObserver = new MutationObserver((records) =>
      this.onFrameAllowAttrChange(records),
    );
  }

  private findIframe(sourceWindow: Window): HTMLIFrameElement | null {
    const iframes = this.frames.keys();
    let frame: IteratorResult<HTMLIFrameElement>;

    do {
      frame = iframes.next();
      if (frame.done) return null;
      if (frame.value.contentWindow === sourceWindow) return frame.value;
    } while (!frame.done);

    return null;
  }

  private observeDocumentForFrames() {
    this.documentObserver.observe(this.document, {
      subtree: true,
      childList: true,
    });
  }

  private observeFrameAllowAttrs(frame: HTMLIFrameElement) {
    this.frameAllowAttrObserver.observe(frame, {
      childList: false,
      attributeOldValue: true,
      attributeFilter: ['allow'],
    });
  }

  async onFrameAllowAttrChange(records: MutationRecord[]) {
    const handledTags = new Set<Node>();

    // Check for a non specified link with the type now specified and
    // just treat it as a newly seen, monetization tag
    for (const record of records) {
      const target = record.target as HTMLIFrameElement;
      if (handledTags.has(target)) {
        continue;
      }
      const hasTarget = this.frames.has(target);
      const typeSpecified =
        target instanceof HTMLIFrameElement && target.allow === 'monetization';

      if (!hasTarget && typeSpecified) {
        await this.onAddedFrame(target);
        handledTags.add(target);
      } else if (hasTarget && !typeSpecified) {
        this.onRemovedFrame(target);
        handledTags.add(target);
      } else if (!hasTarget && !typeSpecified) {
        // ignore these changes
        handledTags.add(target);
      }
    }
  }

  private async onAddedFrame(frame: HTMLIFrameElement) {
    this.frames.set(frame, {
      frameId: null,
      requestIds: [],
    });
  }

  private async onRemovedFrame(frame: HTMLIFrameElement) {
    this.logger.info('onRemovedFrame', frame);

    const frameDetails = this.frames.get(frame);

    const stopMonetizationTags: StopMonetizationPayload =
      frameDetails?.requestIds.map((requestId) => ({
        requestId,
        intent: 'remove',
      })) || [];
    if (stopMonetizationTags.length) {
      this.message.send('STOP_MONETIZATION', stopMonetizationTags);
    }

    this.frames.delete(frame);
  }

  private onWholeDocumentObserved(records: MutationRecord[]) {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.removedNodes) {
          this.check('removed', node);
        }
      }
    }

    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          this.check('added', node);
        }
      }
    }
  }

  async check(op: string, node: Node) {
    if (node instanceof HTMLIFrameElement) {
      if (op === 'added') {
        this.observeFrameAllowAttrs(node);
        await this.onAddedFrame(node);
      } else if (op === 'removed' && this.frames.has(node)) {
        this.onRemovedFrame(node);
      }
    }
  }

  start(): void {
    this.bindMessageHandler();

    if (
      document.readyState === 'interactive' ||
      document.readyState === 'complete'
    )
      this.run();

    document.addEventListener(
      'readystatechange',
      () => {
        if (document.readyState === 'interactive') {
          this.run();
        }
      },
      { once: true },
    );
  }

  private run() {
    const frames: NodeListOf<HTMLIFrameElement> =
      this.document.querySelectorAll('iframe');

    for (const frame of frames) {
      this.observeFrameAllowAttrs(frame);
      void this.onAddedFrame(frame).catch((e) => this.logger.error(e));
    }

    this.observeDocumentForFrames();
  }

  private bindMessageHandler() {
    this.window.addEventListener(
      'message',
      (event: MessageEvent<ContentToContentMessage>) => {
        const { message, payload, id } = event.data;
        if (!HANDLED_MESSAGES.includes(message)) {
          return;
        }
        const eventSource = event.source as Window;
        const frame = this.findIframe(eventSource);
        if (!frame) {
          event.stopPropagation();
          return;
        }

        if (event.origin === this.window.location.href) return;

        switch (message) {
          case 'INITIALIZE_IFRAME':
            event.stopPropagation();
            this.frames.set(frame, {
              frameId: id,
              requestIds: [],
            });
            return;

          case 'IS_MONETIZATION_ALLOWED_ON_START':
            event.stopPropagation();
            if (frame.allow === 'monetization') {
              this.frames.set(frame, {
                frameId: id,
                requestIds: payload.map((p) => p.requestId),
              });
              eventSource.postMessage(
                { message: 'START_MONETIZATION', id, payload },
                '*',
              );
            }

            return;

          case 'IS_MONETIZATION_ALLOWED_ON_RESUME':
            event.stopPropagation();
            if (frame.allow === 'monetization') {
              this.frames.set(frame, {
                frameId: id,
                requestIds: payload.map((p) => p.requestId),
              });
              eventSource.postMessage(
                { message: 'RESUME_MONETIZATION', id, payload },
                '*',
              );
            }
            return;

          default:
            return;
        }
      },
      { capture: true },
    );
  }
}
