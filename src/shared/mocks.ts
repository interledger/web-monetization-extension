jest.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
      },
    },
  },
}));

jest.mock('@/shared/defines', () => ({
  CONFIG_LOG_LEVEL: 'test',
}));

jest.mock('@/shared/helpers', () => ({
  getBrowserName: () => 'chrome',
  tFactory: () => ({
    key: 'translation',
  }),
}));
