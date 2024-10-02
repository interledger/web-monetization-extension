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
  StepRunParams,
  StepWithStatus,
} from './types';

export type { StepRun } from './types';

export const LOGIN_WAIT_TIMEOUT = 10 * 60 * 1000;

const SYMBOL_SKIP = Symbol.for('skip');

export class KeyAutoAdd {
  private port: Runtime.Port;
  private ui: HTMLIFrameElement;

  private stepsInput: Map<string, Step>;
  private steps: StepWithStatus[];

  constructor(steps: Step[]) {
    this.stepsInput = new Map(steps.map((step) => [step.name, step]));
    this.steps = steps.map((step) => ({ name: step.name, status: 'pending' }));
  }

  init() {
    this.port = browser.runtime.connect({ name: CONNECTION_NAME });

    this.port.onMessage.addListener(
      (message: BackgroundToKeyAutoAddMessage) => {
        if (message.action === 'BEGIN') {
          this.run(message.payload);
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
        width: '22rem',
        height: '8rem',
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
    iframeUrl.hash = '?' + params.toString();
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

  private async run({
    walletAddressUrl,
    publicKey,
    nickName,
    keyId,
    keyAddUrl,
  }: BeginPayload) {
    const params: StepRunParams = {
      walletAddressUrl,
      publicKey,
      nickName,
      keyId,
      keyAddUrl,
      skip: (details) => {
        throw {
          type: SYMBOL_SKIP,
          details: typeof details === 'string' ? new Error(details) : details,
        };
      },
      setNotificationSize: (size: 'notification' | 'fullscreen') => {
        this.setNotificationSize(size);
      },
    };

    await this.addNotification();
    this.postMessage('PROGRESS', { steps: this.steps });

    let prevStepId = '';
    let prevStepResult: unknown = undefined;
    for (let stepIdx = 0; stepIdx < this.steps.length; stepIdx++) {
      const step = this.steps[stepIdx];
      const stepInfo = this.stepsInput.get(step.name)!;
      this.setStatus(stepIdx, 'active', {
        expiresAt: stepInfo.maxDuration
          ? new Date(Date.now() + stepInfo.maxDuration).valueOf()
          : undefined,
      });
      try {
        prevStepResult = await this.stepsInput
          .get(step.name)!
          .run(params, prevStepId ? prevStepResult : null);
        this.setStatus(stepIdx, 'success', {});
        prevStepId = step.name;
      } catch (error) {
        if (this.isSkip(error)) {
          const details = this.errorToDetails(
            error.details.error || error.details,
          );
          this.setStatus(stepIdx, 'skipped', { details });
          continue;
        }
        const details = this.errorToDetails(error);
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

  private isSkip(err: unknown): err is { type: symbol; details: Details } {
    if (!err || typeof err !== 'object') return false;
    return 'type' in err && err.type === SYMBOL_SKIP;
  }

  private errorToDetails(err: { message: string } | ErrorWithKeyLike) {
    return isErrorWithKey(err)
      ? { error: errorWithKeyToJSON(err), message: err.key }
      : { message: err.message as string };
  }
}
