/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  passWithNoTests: true,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        babelConfig: false,
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  testRegex: '\\.test\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@test/(.*)$': '<rootDir>/../../tools/test/$1',
    '^agentic-kit$': '<rootDir>/../../packages/agentic-kit/src',
    '^@agentic-kit/(.*)$': '<rootDir>/../../packages/$1/src',
  },
};
