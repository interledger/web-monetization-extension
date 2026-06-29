import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ReadableStream } from 'node:stream/web';
import { TextEncoder, TextDecoder } from 'node:util';
import { MessagePort } from 'node:worker_threads';

afterEach(() => {
  cleanup();
});

vi.mock('@/shared/defines', () => ({
  LOG_LEVEL: 'debug',
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
}));

Object.assign(global, {
  ReadableStream,
  MessagePort,
  TextDecoder,
  TextEncoder,
});
