const mockExeca = jest.fn(() => Promise.resolve({
  stdout: 'mocked output',
  stderr: '',
  exitCode: 0,
  command: 'mocked command',
  escapedCommand: 'mocked command',
  failed: false,
  timedOut: false,
  isCanceled: false,
  killed: false
}));

module.exports = mockExeca;
module.exports.execa = mockExeca;
module.exports.default = mockExeca;
