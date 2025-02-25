import { Cradle } from '@/content/container';

export class IdleDetection {
  private document: Cradle['document'];
  private logger: Cradle['logger'];
  // Pass this to the class to make e2e testing easier instead of declaring
  // it here.
  private isIdle: boolean = false;
  private readonly idleTimeout: number = 10000;

  constructor({ document, logger }: Cradle) {
    Object.assign(this, {
      document,
      logger,
    });
  }

  detectUserInactivity() {
    let lastActive = Date.now();
    let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

    const onInactivityTimeoutReached = () => {
      const now = Date.now();
      const timeLeft = lastActive + this.idleTimeout - now;

      // There is probably an edge case when the timeout is reached and the user
      // will move the mouse at the same time?
      if (timeLeft <= 0) {
        // Send `STOP_MONETIZATION`.
        this.logger.debug(
          `No activity from the user - stopping monetization` +
            `  Last active: ${new Date(lastActive).toLocaleString()}`,
        );
        this.isIdle = true;
      }
    };

    const activityListener = () => {
      lastActive = Date.now();
      if (this.isIdle) {
        this.logger.debug('Detected user activity - resuming monetization');
        // Send `RESUME_MONETIZATION`
        this.isIdle = false;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(onInactivityTimeoutReached, this.idleTimeout);
      }
    };

    timeoutId = setTimeout(onInactivityTimeoutReached, this.idleTimeout);

    this.registerDocumentEventListeners(activityListener);
    this.logger.debug('Started listening for user activity');

    // We should probably have a cleanup when the document is not focused?
  }

  private registerDocumentEventListeners(fn: () => void) {
    // Additional events that we might want to register:
    // - mousedown
    // - touchstart (not relevant at the moment)
    // - touchmove (not relevant at the moment)
    // - click
    // - keydown
    // - scroll (will this bubble when scrolling inside a scrollable element?)
    // - wheel
    this.document.addEventListener('mousemove', fn);
  }
}
