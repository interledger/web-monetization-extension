export default {
  preset: 'ts-jest',
  clearMocks: true,
  displayName: 'WM Extension',
  collectCoverageFrom: [
    'src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.css',
    '!src/**/*.svg',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  maxWorkers: '50%',
  moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
  moduleNameMapper: {
    '^webextension-polyfill$': '<rootDir>/src/shared/mocks.ts',
    '@/(.*)': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['./jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/',
    '<rootDir>/jest.config.ts',
  ],
  transform: {
    '^.+\\.(js|jsx|mjs)$': 'babel-jest',
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '\\.(css|less|scss|sass|svg)$': 'jest-transform-stub',
  },
  transformIgnorePatterns: ['/node_modules/(?!awilix)/'],
};
