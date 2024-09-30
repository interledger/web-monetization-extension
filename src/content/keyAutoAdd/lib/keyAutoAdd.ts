import browser, { type Runtime } from 'webextension-polyfill';
import { CONNECTION_NAME } from '@/background/services/keyAutoAdd';
import type { ErrorWithKeyLike } from '@/shared/helpers';
import type {
  BackgroundToKeyAutoAddMessage,
  BeginPayload,
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

  private async run({
    walletAddressUrl,
    publicKey,
    nickName,
    keyId,
  }: BeginPayload) {
    const params: StepRunParams = {
      walletAddressUrl,
      publicKey,
      nickName,
      keyId,
      skip: (message) => {
        throw { type: SYMBOL_SKIP, message };
      },
    };
    let prevStepId = '';
    let prevStepResult: unknown = undefined;
    for (const [stepIdx, step] of this.steps.entries()) {
      step.status = 'active';
      this.postMessage('PROGRESS', { steps: this.steps });
      try {
        prevStepResult = await this.stepsInput
          .get(step.name)!
          .run(params, prevStepId ? prevStepResult : null);
        step.status = 'success';
        prevStepId = step.name;
      } catch (error) {
        if (KeyAutoAdd.isSkip(error)) {
          this.steps[stepIdx] = {
            ...this.steps[stepIdx],
            status: 'skipped',
            details: { message: error.message },
          };
          continue;
        }
        this.postMessage('PROGRESS', { steps: this.steps });
        this.steps[stepIdx] = {
          ...this.steps[stepIdx],
          status: 'error',
          details: { message: error.message },
        };
        this.postMessage('ERROR', {
          error: { message: error.message },
          stepName: step.name,
          stepIdx,
        });
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

  static isSkip(
    err: unknown,
  ): err is { type: symbol; message?: string | ErrorWithKeyLike } {
    if (!err || typeof err !== 'object') return false;
    return 'type' in err && err.type === SYMBOL_SKIP;
  }
}
