// cSpell:ignore allowtransparency
import browser, { type Runtime } from 'webextension-polyfill';
import { CONNECTION_NAME } from '@/background/services/keyAutoAdd';
import {
  errorWithKeyToJSON,
  isErrorWithKey,
  sleep,
  withResolvers,
  type ErrorWithKeyLike,
} from '@/shared/helpers';
import type {
  BackgroundToKeyAutoAddMessage,
  BeginPayload,
  Details,
  KeyAutoAddToBackgroundMessage,
  KeyAutoAddToBackgroundMessagesMap,
  Step,
  StepRun,
  StepRunHelpers,
  StepWithStatus,
} from './types';

export type { StepRun } from './types';

export const LOGIN_WAIT_TIMEOUT = 10 * 60 * 1000;

export class KeyAutoAdd {
  private port: Runtime.Port;
  private ui: HTMLIFrameElement;

  private stepsInput: Map<string, Step>;
  private steps: StepWithStatus[];
  private outputs = new Map<StepRun, unknown>();

  constructor(steps: Step[]) {
    this.stepsInput = new Map(steps.map((step) => [step.name, step]));
    this.steps = steps.map((step) => ({ name: step.name, status: 'pending' }));
  }

  init() {
    this.port = browser.runtime.connect({ name: CONNECTION_NAME });

    this.port.onMessage.addListener(
      (message: BackgroundToKeyAutoAddMessage) => {
        if (message.action === 'BEGIN') {
          this.runAll(message.payload);
        }
      },
    );
  }

  private setNotificationSize(size: 'notification' | 'fullscreen' | 'hidden') {
    let styles: Partial<CSSStyleDeclaration>;
    const defaultStyles: Partial<CSSStyleDeclaration> = {
      outline: 'none',
      border: 'none',
      zIndex: '9999',
      position: 'fixed',
      top: '0',
      left: '0',
    };

    if (size === 'notification') {
      styles = {
        width: '22em',
        height: '8em',
        fontSize: '16px',
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        left: 'initial',
        boxShadow: 'rgba(0, 0, 0, 0.1) 0px 0px 6px 3px',
        borderRadius: '0.5rem',
      };
    } else if (size === 'fullscreen') {
      styles = {
        width: '100vw',
        height: '100vh',
      };
    } else {
      styles = {
        width: '0',
        height: '0',
        position: 'absolute',
      };
    }

    this.ui.style.cssText = '';
    Object.assign(this.ui.style, defaultStyles);
    Object.assign(this.ui.style, styles);

    const iframeUrl = new URL(
      browser.runtime.getURL('pages/progress-connect/index.html'),
    );
    const params = new URLSearchParams({ mode: size });
    iframeUrl.hash = `?${params.toString()}`;
    if (this.ui.src !== iframeUrl.href && size !== 'hidden') {
      this.ui.src = iframeUrl.href;
    }
  }

  private addNotification() {
    const { resolve, reject, promise } = withResolvers<void>();
    if (this.ui) {
      resolve();
      return promise;
    }
    const pageUrl = browser.runtime.getURL('pages/progress-connect/index.html');
    const iframe = document.createElement('iframe');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.src = pageUrl;
    document.body.appendChild(iframe);
    iframe.addEventListener('load', () => {
      resolve();
      sleep(500).then(() =>
        this.postMessage('PROGRESS', { steps: this.steps }),
      );
    });
    iframe.addEventListener('error', reject, { once: true });
    this.ui = iframe;
    this.setNotificationSize('hidden');
    return promise;
  }

  private async runAll(payload: BeginPayload) {
    const helpers: StepRunHelpers = {
      output: <T extends StepRun>(fn: T) => {
        if (!this.outputs.has(fn)) {
          // Was never run? Was skipped?
          throw new Error('Given step has no output');
        }
        return this.outputs.get(fn) as Awaited<ReturnType<T>>;
      },
      skip: (details) => {
        throw new SkipError(
          typeof details === 'string' ? { message: details } : details,
        );
      },
      setNotificationSize: (size: 'notification' | 'fullscreen') => {
        this.setNotificationSize(size);
      },
    };

    await this.addNotification();
    this.postMessage('PROGRESS', { steps: this.steps });

    for (let stepIdx = 0; stepIdx < this.steps.length; stepIdx++) {
      const step = this.steps[stepIdx];
      const stepInfo = this.stepsInput.get(step.name);
      if (!stepInfo) {
        throw new Error("Given step doesn't exist");
      }
      this.setStatus(stepIdx, 'active', {
        expiresAt: stepInfo.maxDuration
          ? new Date(Date.now() + stepInfo.maxDuration).valueOf()
          : undefined,
      });
      try {
        const run = stepInfo.run;
        const res = await run(payload, helpers);
        this.outputs.set(run, res);
        this.setStatus(stepIdx, 'success', {});
      } catch (error) {
        if (error instanceof SkipError) {
          const details = error.toJSON();
          this.setStatus(stepIdx, 'skipped', { details });
          continue;
        }
        const details = errorToDetails(error);
        this.setStatus(stepIdx, 'error', { details: details });
        this.postMessage('ERROR', { details, stepName: step.name, stepIdx });
        this.port.disconnect();
        return;
      }
    }
    this.postMessage('PROGRESS', { steps: this.steps });
    this.postMessage('SUCCESS', true);
    this.port.disconnect();
  }

  private postMessage<T extends keyof KeyAutoAddToBackgroundMessagesMap>(
    action: T,
    payload: KeyAutoAddToBackgroundMessagesMap[T],
  ) {
    const message = { action, payload } as KeyAutoAddToBackgroundMessage;
    this.port.postMessage(message);
  }

  private setStatus<T extends StepWithStatus['status']>(
    stepIdx: number,
    status: T,
    data: Omit<Extract<StepWithStatus, { status: T }>, 'name' | 'status'>,
  ) {
    // @ts-expect-error what's missing is part of data, TypeScript!
    this.steps[stepIdx] = {
      name: this.steps[stepIdx].name,
      status,
      ...data,
    };
    this.postMessage('PROGRESS', { steps: this.steps });
  }
}

class SkipError extends Error {
  public readonly error?: ErrorWithKeyLike;
  constructor(err: ErrorWithKeyLike | { message: string }) {
    const { message, error } = errorToDetails(err);
    super(message);
    this.error = error;
  }

  toJSON(): Details {
    return { message: this.message, error: this.error };
  }
}

function errorToDetails(err: { message: string } | ErrorWithKeyLike): Details {
  return isErrorWithKey(err)
    ? { error: errorWithKeyToJSON(err), message: err.key }
    : { message: err.message as string };
}
