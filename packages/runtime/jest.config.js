/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        babelConfig: false,
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  transformIgnorePatterns: [`/node_modules/(?!(execa)/)`],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  modulePathIgnorePatterns: ['dist/*'],
  moduleNameMapper: {
    '^@agentic-kit/(.*)$': '<rootDir>/../$1/src',
    '^execa$': '<rootDir>/__mocks__/execa.js'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
