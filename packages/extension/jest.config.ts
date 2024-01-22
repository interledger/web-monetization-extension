import config from '../../jest.config';

export default {
  ...config,
  displayName: '[WM] Extension',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  testEnvironment: 'jsdom',
};
