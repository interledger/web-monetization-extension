import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'node:util';
import { chrome } from 'jest-chrome';

jest.mock('./src/shared/defines', () => ({
  LOG_LEVEL: 'debug',
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
}));

Object.assign(global, {
  TextDecoder,
  TextEncoder,
  chrome: chrome,
  browser: chrome,
});
