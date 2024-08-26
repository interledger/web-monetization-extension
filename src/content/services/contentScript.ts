import type { ToContentMessage } from '@/shared/messages';
import { failure } from '@/shared/helpers';
import type { Cradle } from '@/content/container';

export class ContentScript {
  private browser: Cradle['browser'];
  private window: Cradle['window'];
  private logger: Cradle['logger'];
  private monetizationTagManager: Cradle['monetizationTagManager'];
  private frameManager: Cradle['frameManager'];

  private isFirstLevelFrame: boolean;
  private isTopFrame: boolean;

  constructor({
    browser,
    window,
    logger,
    monetizationTagManager,
    frameManager,
  }: Cradle) {
    Object.assign(this, {
      browser,
      window,
      logger,
      monetizationTagManager,
      frameManager,
    });

    this.isTopFrame = window === window.top;
    this.isFirstLevelFrame = window.parent === window.top;

    this.bindMessageHandler();
  }

  async start() {
    await this.injectPolyfill();
    if (this.isFirstLevelFrame) {
      this.logger.info('Content script started');

      if (this.isTopFrame) this.frameManager.start();

      this.monetizationTagManager.start();
    }
  }

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(
      async (message: ToContentMessage) => {
        try {
          switch (message.action) {
            case 'MONETIZATION_EVENT':
              this.monetizationTagManager.dispatchMonetizationEvent(
                message.payload,
              );
              return;
            default:
              return;
          }
        } catch (e) {
          this.logger.error(message.action, e.message);
          return failure(e.message);
        }
      },
    );
  }

  // TODO: When Firefox has good support for `world: MAIN`, inject this directly
  // via manifest.json https://bugzilla.mozilla.org/show_bug.cgi?id=1736575
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
