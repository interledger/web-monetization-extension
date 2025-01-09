import '@testing-library/jest-dom';

import { chrome } from 'jest-chrome';

jest.mock('./src/shared/defines', () => ({
  LOG_LEVEL: 'debug',
  PERMISSION_HOSTS: { origins: ['http://*/*', 'https://*/*'] },
  ALLOWED_PROTOCOLS: ['http:', 'https:'],
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
}));

Object.assign(global, {
  chrome: chrome,
  browser: chrome,
});
