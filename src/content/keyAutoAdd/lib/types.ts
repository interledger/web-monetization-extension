export interface StepRunParams extends BeginPayload {
  helpers: Record<string, never>;
}

export type StepRun<T = unknown, R = void> = (
  params: StepRunParams,
  prevStep: [
    result: T extends (...args: any[]) => PromiseLike<any>
      ? Awaited<ReturnType<T>>
      : T,
    id: string,
  ],
) => Promise<R>;

export interface Step<T = unknown, R = unknown> {
  id: string;
  run: StepRun<T, R>;
}

export interface StepWithStatus {
  id: Step['id'];
  status: 'pending' | 'active' | 'error' | 'success' | 'skipped';
}

export interface BeginPayload {
  walletAddressUrl: string;
  publicKey: string;
  nickName: string;
}

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
