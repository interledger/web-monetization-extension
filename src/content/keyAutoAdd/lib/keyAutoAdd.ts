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

  private async run({ walletAddressUrl, publicKey }: BeginPayload) {
    const params: StepRunParams = { walletAddressUrl, publicKey };
    for (const [stepIdx, step] of this.steps.entries()) {
      step.status = 'active';
      this.postMessage('PROGRESS', { steps: this.steps });
      try {
        await this.stepsInput.get(step.id)!.run(params);
        step.status = 'success';
      } catch (error) {
        console.error(error)
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
