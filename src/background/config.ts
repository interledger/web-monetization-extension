export const DEFAULT_SCALE = 2;
export const DEFAULT_INTERVAL_MS = 3_600_000;

export const DEFAULT_RATE_OF_PAY = '60';
export const MAX_RATE_OF_PAY = '100';

/** Minimum wait time between two consecutive continuous payments */
export const MIN_PAYMENT_WAIT = 2000;

export const EXCHANGE_RATES_URL =
  'https://telemetry-exchange-rates.s3.amazonaws.com/exchange-rates-usd.json';

export const OUTGOING_PAYMENT_POLLING_MAX_DURATION = 8_000;
export const OUTGOING_PAYMENT_POLLING_INITIAL_DELAY = 1500;
export const OUTGOING_PAYMENT_POLLING_INTERVAL = 1500;
export const OUTGOING_PAYMENT_POLLING_MAX_ATTEMPTS = 8;

/**
 * This a bit long to give users enough time in case they need to login (and not
 * everyone has a password manager ready for quick login). If we were sure that
 * user is logged in, we could make it < 1min.
 */
export const ACCEPT_GRANT_TIMEOUT = 3 * 60 * 1000;
