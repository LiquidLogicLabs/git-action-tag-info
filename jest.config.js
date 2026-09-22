module.exports = {
  // Coverage ratchet: the measured values when this was introduced, floored to the
  // integer below so the gate catches a real regression without failing on
  // sub-percent variation. A floor to raise, never to lower -- if a change
  // legitimately reduces coverage, say so in the commit rather than editing this
  // quietly.
  coverageThreshold: {
    global: {
      statements: 33,
      branches: 27,
      functions: 38,
      lines: 33
    }
  },
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

