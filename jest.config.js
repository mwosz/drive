/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/*.unit.test.ts',
    '**/tests/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': '@swc/jest'
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!**/tests/**',
    '!**/dist/**',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage'
};
