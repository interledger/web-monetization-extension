import browser, { type Runtime } from 'webextension-polyfill';
import { CONNECTION_NAME } from '@/background/services/keyAutoAdd';
import {
  errorWithKeyToJSON,
  isErrorWithKey,
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
    };
    let prevStepId = '';
    let prevStepResult: unknown = undefined;
    for (let stepIdx = 0; stepIdx < this.steps.length; stepIdx++) {
      const step = this.steps[stepIdx];
      this.setStatus(stepIdx, 'active', {});
      this.postMessage('PROGRESS', { steps: this.steps });
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
