import type { ToContentMessage } from '@/shared/messages';
import type { Cradle } from '@/content/container';
import { failure, success } from '@/shared/helpers';

export class ContentScript {
  private browser: Cradle['browser'];
  private window: Cradle['window'];
  private logger: Cradle['logger'];
  private monetizationLinkManager: Cradle['monetizationLinkManager'];
  private frameManager: Cradle['frameManager'];

  private isFirstLevelFrame: boolean;
  private isTopFrame: boolean;

  constructor({
    browser,
    window,
    logger,
    monetizationLinkManager,
    frameManager,
  }: Cradle) {
    Object.assign(this, {
      browser,
      window,
      logger,
      monetizationLinkManager,
      frameManager,
    });

    this.isTopFrame = window === window.top;
    this.isFirstLevelFrame = window.parent === window.top;
  }

  async start() {
    // await this.injectPolyfill();
    this.browser.runtime.onMessage.addListener(this.onMessage);
    if (this.isFirstLevelFrame) {
      this.logger.info('Content script started');

      // if (this.isTopFrame) this.frameManager.start();

      this.monetizationLinkManager.start();
    }
  }

  public end() {
    this.logger.info('Disconnected, cleaning up');
    this.browser.runtime.onMessage.removeListener(this.onMessage);
    this.monetizationLinkManager.end();
    // if (this.isTopFrame) this.frameManager.end();
  }

  private onMessage = async (message: ToContentMessage) => {
    try {
      switch (message.action) {
        case 'MONETIZATION_EVENT':
          this.monetizationLinkManager.dispatchMonetizationEvent(
            message.payload,
          );
          return;
        case 'IS_TAB_IN_VIEW':
          return success(document.visibilityState === 'visible');
        default:
          return;
      }
    } catch (e) {
      this.logger.error(message.action, e.message);
      return failure(e.message);
    }
  };

  // TODO: When Firefox has good support for `world: MAIN`, inject this directly
  // via manifest.json https://bugzilla.mozilla.org/show_bug.cgi?id=1736575 and
  // remove this, along with injectPolyfill from background
  // See: https://github.com/interledger/web-monetization-extension/issues/607
  async injectPolyfill() {
    const document = this.window.document;
    const script = document.createElement('script');
    script.src = this.browser.runtime.getURL('polyfill/polyfill.js');
    await new Promise<void>((resolve) => {
      script.addEventListener('load', () => resolve(), { once: true });
      document.documentElement.appendChild(script);
    });
    script.remove();
  }
}
