import type { LogLevelDesc } from 'loglevel';

declare const CONFIG_LOG_LEVEL: LogLevelDesc;
declare const CONFIG_LOG_SERVER_ENDPOINT: string | false;
declare const CONFIG_OPEN_PAYMENTS_REDIRECT_URL: string;
declare const CONFIG_POSTHOG_KEY: string;
declare const CONFIG_POSTHOG_HOST: string;

export const LOG_LEVEL = CONFIG_LOG_LEVEL;
export const LOG_SERVER_ENDPOINT = CONFIG_LOG_SERVER_ENDPOINT;
export const OPEN_PAYMENTS_REDIRECT_URL = CONFIG_OPEN_PAYMENTS_REDIRECT_URL;

export const POSTHOG_KEY = CONFIG_POSTHOG_KEY;
export const POSTHOG_HOST = CONFIG_POSTHOG_HOST;
