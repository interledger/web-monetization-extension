import type { Config } from 'jest';

export default {
  clearMocks: true,
  displayName: 'WM Extension',
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  maxWorkers: '50%',
  moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
  },
  passWithNoTests: true,
  setupFilesAfterEnv: ['jest-expect-message', './jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/',
    '<rootDir>/jest.config.ts',
  ],
  transform: {
    '^.+\\.(ts|tsx)?$': '@jgoz/jest-esbuild',
    '\\.(css|less|scss|sass|svg)$': 'jest-transform-stub',
  },
} satisfies Config;
