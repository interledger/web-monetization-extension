import '@testing-library/jest-dom';
import { ReadableStream } from 'node:stream/web';
import { TextEncoder, TextDecoder } from 'node:util';
import { MessagePort } from 'node:worker_threads';
import { chrome } from 'jest-chrome';

jest.mock('./src/shared/defines', () => ({
  LOG_LEVEL: 'debug',
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
}));

Object.assign(global, {
  ReadableStream,
  MessagePort,
  TextDecoder,
  TextEncoder,
  chrome: chrome,
  browser: chrome,
});
