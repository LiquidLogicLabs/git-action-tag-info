module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@octokit/rest$': '<rootDir>/src/__mocks__/@octokit/rest.ts',
    '^@octokit/plugin-throttling$': '<rootDir>/src/__mocks__/@octokit/plugin-throttling.ts',
  },
};

