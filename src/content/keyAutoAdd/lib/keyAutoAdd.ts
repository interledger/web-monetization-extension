import browser, { type Runtime } from 'webextension-polyfill';
import { CONNECTION_NAME } from '@/background/services/keyShare';
import type {
  BackgroundToContentMessage,
  BeginPayload,
  ContentToBackgroundMessage,
  ContentToBackgroundMessagesMap,
  Step,
  StepRunParams,
  StepWithStatus,
} from './types';

export type { StepRun } from './types';

export const LOGIN_WAIT_TIMEOUT = 10 * 60 * 1000;

export class KeyAutoAdd {
  private port: Runtime.Port;

  private stepsInput: Map<string, Step>;
  private steps: StepWithStatus[];

  constructor(steps: Step[]) {
    this.stepsInput = new Map(steps.map((step) => [step.id, step]));
    this.steps = steps.map((step) => ({ id: step.id, status: 'pending' }));
  }

  init() {
    this.port = browser.runtime.connect({ name: CONNECTION_NAME });

    this.port.onMessage.addListener((message: BackgroundToContentMessage) => {
      if (message.action === 'BEGIN') {
        this.run(message.payload);
      }
    });
  }

  private async run({ walletAddressUrl, publicKey, nickName }: BeginPayload) {
    const params: StepRunParams = { walletAddressUrl, publicKey, nickName };
    let prevStepId = '';
    let prevStepResult: unknown = undefined;
    for (const [stepIdx, step] of this.steps.entries()) {
      step.status = 'active';
      this.postMessage('PROGRESS', { steps: this.steps });
      try {
        prevStepResult = await this.stepsInput
          .get(step.id)!
          .run(params, prevStepId ? [prevStepResult, prevStepId] : [null, '']);
        prevStepId = step.id;
        step.status = 'success';
      } catch (error) {
        step.status = 'error';
        this.postMessage('ERROR', {
          error: { message: error.message },
          stepId: step.id,
          stepIdx,
        });
        this.port.disconnect();
        return;
      }
    }
    this.postMessage('SUCCESS', true);
    this.port.disconnect();
  }

  private postMessage<T extends keyof ContentToBackgroundMessagesMap>(
    action: T,
    payload: ContentToBackgroundMessagesMap[T],
  ) {
    const message = { action, payload } as ContentToBackgroundMessage;
    this.port.postMessage(message);
  }
}
