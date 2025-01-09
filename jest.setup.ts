import '@testing-library/jest-dom';

import { chrome } from 'jest-chrome';

jest.mock('./src/shared/defines', () => ({
  LOG_LEVEL: 'info',
  PERMISSION_HOSTS: { origins: [] },
  ALLOWED_PROTOCOLS: [],
  OPEN_PAYMENTS_REDIRECT_URL: 'https://webmonetization.org/welcome',
}));

Object.assign(global, {
  chrome: chrome,
  browser: chrome,
});
