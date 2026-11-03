import type { ToContentMessage } from '@/shared/messages';
import type { Cradle } from '@/content/container';
import { failure, success } from '@/shared/messages';

/**
 * Dispatched (cancelable) on the document by every content script instance when
 * it starts. An instance already running in the document answers:
 * - if it can still reach the extension, it cancels the event, and the new
 *   instance doesn't start (avoids two instances monetizing the same page);
 * - if it can't (extension updated/reloaded/disabled), it stops, and the new
 *   instance takes over.
 */
const CONTENT_SCRIPT_STARTED_EVENT = '__wm_ext_content_script_started';

export class ContentScript {
  private browser: Cradle['browser'];
  private global: Cradle['global'];
  private document: Cradle['document'];
  private logger: Cradle['logger'];
  private message: Cradle['message'];
  private monetizationLinkManager: Cradle['monetizationLinkManager'];
  private frameManager: Cradle['frameManager'];

  private isFirstLevelFrame: boolean;
  private isTopFrame: boolean;
  private stopped = false;
  private announcing = false;

  constructor({
    browser,
    window,
    global,
    document,
    logger,
    message,
    monetizationLinkManager,
    frameManager,
  }: Cradle) {
    this.browser = browser;
    this.global = global;
    this.document = document;
    this.logger = logger;
    this.message = message;
    this.monetizationLinkManager = monetizationLinkManager;
    this.frameManager = frameManager;

    this.isTopFrame = window === window.top;
    this.isFirstLevelFrame = window.parent === window.top;

    this.bindMessageHandler();
    this.message.onInvalidated(() => this.stop());
    this.document.addEventListener(
      CONTENT_SCRIPT_STARTED_EVENT,
      this.onContentScriptStarted,
    );
  }

  async start() {
    if (this.isAnotherInstanceRunning()) {
      this.stop('another instance is already running');
      return;
    }

    if (this.isFirstLevelFrame) {
      this.logger.info('Content script started');

      if (this.isTopFrame) this.frameManager.start();

      this.monetizationLinkManager.start();
    }
  }

  /**
   * Stop observing the page and stop talking to the background. Used once this
   * instance has lost its connection to the extension (updated, reloaded or
   * disabled), or when it isn't needed.
   */
  stop(reason = 'extension context invalidated') {
    if (this.stopped) return;
    this.stopped = true;

    this.document.removeEventListener(
      CONTENT_SCRIPT_STARTED_EVENT,
      this.onContentScriptStarted,
    );
    try {
      this.browser.runtime.onMessage.removeListener(this.onMessage);
    } catch {
      // the runtime may already be gone
    }
    this.monetizationLinkManager.end();
    this.frameManager.end();
    this.logger.info(`Content script stopped: ${reason}`);
  }

  private isAnotherInstanceRunning(): boolean {
    const { CustomEvent } = this.global;
    const event = new CustomEvent(CONTENT_SCRIPT_STARTED_EVENT, {
      cancelable: true,
    });
    this.announcing = true;
    try {
      return !this.document.dispatchEvent(event);
    } finally {
      this.announcing = false;
    }
  }

  private onContentScriptStarted = (event: Event) => {
    if (this.announcing || this.stopped) return;
    // Another instance is starting in this document (e.g. injected after an
    // extension update).
    if (this.message.isContextValid) {
      event.preventDefault();
    } else {
      this.stop();
    }
  };

  private onMessage = async (msg: unknown) => {
    const message = msg as ToContentMessage;
    try {
      switch (message.action) {
        case 'MONETIZATION_EVENT':
          this.monetizationLinkManager.dispatchMonetizationEvent(
            message.payload,
          );
          return;
        case 'IS_TAB_IN_VIEW':
          return success(document.visibilityState === 'visible');
        case 'REQUEST_RESUME_MONETIZATION':
          await this.monetizationLinkManager.resumeMonetization();
          return;
        default:
          return;
      }
    } catch (e) {
      this.logger.error(message.action, e.message);
      return failure(e.message);
    }
  };

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(this.onMessage);
  }
}
