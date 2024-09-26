export interface StepRunParams {
  walletAddressUrl: string;
  publicKey: string;
}

export type StepRun<T = unknown, R = unknown> = (
  params: StepRunParams,
  prevStep: [
    result: T extends (...args: any[]) => PromiseLike<any>
      ? Awaited<ReturnType<T>>
      : T,
    id: string,
  ],
) => Promise<R>;

export interface Step<T = any, R = any> {
  id: string;
  run: StepRun<T, R>;
}

export interface StepWithStatus {
  id: Step['id'];
  status: 'pending' | 'active' | 'error' | 'success' | 'skipped';
}

export type BeginPayload = {
  walletAddressUrl: string;
  publicKey: string;
};

export type BackgroundToContentMessagesMap = {
  BEGIN: BeginPayload;
};

export type BackgroundToContentMessage = {
  [K in keyof BackgroundToContentMessagesMap]: {
    action: K;
    payload: BackgroundToContentMessagesMap[K];
  };
}[keyof BackgroundToContentMessagesMap];

export type ContentToBackgroundMessagesMap = {
  PROGRESS: { steps: StepWithStatus[] };
  SUCCESS: true;
  ERROR: {
    stepIdx: number;
    stepId: StepWithStatus['id'];
    error: { message: string };
  };
};

export type ContentToBackgroundMessage = {
  [K in keyof ContentToBackgroundMessagesMap]: {
    action: K;
    payload: ContentToBackgroundMessagesMap[K];
  };
}[keyof ContentToBackgroundMessagesMap];
