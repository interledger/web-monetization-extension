import type { ErrorWithKeyLike } from '@/shared/helpers';
import type { ErrorResponse } from '@/shared/messages';

export interface StepRunParams extends BeginPayload {
  skip: (message: string | Error | ErrorWithKeyLike) => never;
}

export type StepRun<T = unknown, R = void> = (
  params: StepRunParams,
  prevStepResult: T extends (...args: any[]) => PromiseLike<any>
    ? Exclude<Awaited<ReturnType<T>>, void | { type: symbol }>
    : T,
) => Promise<R | void>;

export interface Step<T = unknown, R = unknown> {
  name: string;
  run: StepRun<T, R>;
}

export type Details = Omit<ErrorResponse, 'success'>;

interface StepWithStatusBase {
  name: Step['name'];
  status: string;
}
interface StepWithStatusNormal extends StepWithStatusBase {
  status: 'pending' | 'active' | 'success';
}
interface StepWithStatusSkipped extends StepWithStatusBase {
  status: 'skipped';
  details: Details;
}
interface StepWithStatusError extends StepWithStatusBase {
  status: 'error';
  details: Details;
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
  keyAddUrl: string;
}

export type BackgroundToKeyAutoAddMessagesMap = {
  BEGIN: BeginPayload;
};

export type BackgroundToKeyAutoAddMessage = {
  [K in keyof BackgroundToKeyAutoAddMessagesMap]: {
    action: K;
    payload: BackgroundToKeyAutoAddMessagesMap[K];
  };
}[keyof BackgroundToKeyAutoAddMessagesMap];

export type KeyAutoAddToBackgroundMessagesMap = {
  PROGRESS: { steps: StepWithStatus[] };
  SUCCESS: true;
  ERROR: {
    stepIdx: number;
    stepName: StepWithStatus['name'];
    details: Details;
  };
};

export type KeyAutoAddToBackgroundMessage = {
  [K in keyof KeyAutoAddToBackgroundMessagesMap]: {
    action: K;
    payload: KeyAutoAddToBackgroundMessagesMap[K];
  };
}[keyof KeyAutoAddToBackgroundMessagesMap];
