import type {
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload,
} from '@/shared/messages';

export interface ContentToContentMessageMap {
  INITIALIZE_IFRAME: void;
  IS_MONETIZATION_ALLOWED_ON_START: StartMonetizationPayload;
  IS_MONETIZATION_ALLOWED_ON_RESUME: ResumeMonetizationPayload;
  IS_MONETIZATION_ALLOWED_ON_STOP: StopMonetizationPayload;
  START_MONETIZATION: StartMonetizationPayload;
  STOP_MONETIZATION: StopMonetizationPayload;
  RESUME_MONETIZATION: ResumeMonetizationPayload;
}

export type ContentToContentMessage = {
  [K in keyof ContentToContentMessageMap]: {
    message: K;
    id: string;
    payload: ContentToContentMessageMap[K];
  };
}[keyof ContentToContentMessageMap];
