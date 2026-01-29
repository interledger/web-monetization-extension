import type { ToContentMessage } from '@/shared/messages';
import type { Cradle } from '@/content/container';
import { failure, success } from '@/shared/messages';

export class ContentScript {
  private browser: Cradle['browser'];
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
      logger,
      monetizationLinkManager,
      frameManager,
    });

    this.isTopFrame = window === window.top;
    this.isFirstLevelFrame = window.parent === window.top;

    this.bindMessageHandler();
  }

  async start() {
    if (this.isFirstLevelFrame) {
      this.logger.info('Content script started');

      if (this.isTopFrame) this.frameManager.start();

      this.monetizationLinkManager.start();
    }
  }

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(
      async (message: ToContentMessage) => {
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
      },
    );
  }
}
