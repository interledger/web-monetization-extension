import type { ErrorWithKeyLike } from '@/shared/helpers';
import type { ErrorResponse } from '@/shared/messages';

export interface StepRunHelpers {
  skip: (message: string | Error | ErrorWithKeyLike) => never;
  setNotificationSize: (size: 'notification' | 'fullscreen') => void;
  output: <T extends StepRun>(fn: T) => Awaited<ReturnType<T>>;
}

export type StepRun<TOutput = unknown> = (
  payload: BeginPayload,
  helpers: StepRunHelpers,
) => Promise<TOutput>;

export interface Step<TOutput = unknown> {
  name: string;
  run: StepRun<TOutput>;
  maxDuration?: number;
}

export type Details = Omit<ErrorResponse, 'success'>;

interface StepWithStatusBase {
  name: Step['name'];
  status: string;
  maxDuration: number;
}
interface StepWithStatusNormal extends StepWithStatusBase {
  status: 'pending' | 'success';
}
interface StepWithStatusActive extends StepWithStatusBase {
  status: 'active';
  expiresAt?: number;
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
  | StepWithStatusActive
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
