import type { ErrorWithKeyLike } from '@/shared/helpers';
import type { ErrorResponse } from '@/shared/messages';

export interface StepRunParams extends BeginPayload {
  skip: (message?: string | ErrorWithKeyLike) => never;
}

export type StepRun<T = unknown, R = void> = (
  params: StepRunParams,
  prevStepResult: T extends (...args: any[]) => PromiseLike<any>
    ? Exclude<Awaited<ReturnType<T>>, void | { type: symbol }>
    : T,
) => Promise<R | void>;

export interface Step<T = unknown, R = unknown> {
  id: string;
  run: StepRun<T, R>;
}

interface StepWithStatusBase {
  id: string;
  status: string;
}
interface StepWithStatusNormal extends StepWithStatusBase {
  status: 'pending' | 'active' | 'success';
}
interface StepWithStatusSkipped extends StepWithStatusBase {
  status: 'skipped';
  details: { message?: string | ErrorWithKeyLike };
}
interface StepWithStatusError extends StepWithStatusBase {
  status: 'error';
  details: Omit<ErrorResponse, 'success'>;
}

export type StepWithStatus =
  | StepWithStatusNormal
  | StepWithStatusSkipped
  | StepWithStatusError;

export interface BeginPayload {
  walletAddressUrl: string;
  publicKey: string;
  keyId: string;
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
