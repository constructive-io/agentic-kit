const mockGit = {
  status: jest.fn(() => Promise.resolve({ files: [] })),
  add: jest.fn(() => Promise.resolve()),
  commit: jest.fn(() => Promise.resolve()),
  push: jest.fn(() => Promise.resolve()),
  pull: jest.fn(() => Promise.resolve()),
  checkoutLocalBranch: jest.fn(() => Promise.resolve()),
  checkout: jest.fn(() => Promise.resolve()),
  diff: jest.fn(() => Promise.resolve('mock diff')),
  log: jest.fn(() => Promise.resolve({ all: [] }))
};

const simpleGit = jest.fn(() => mockGit);

module.exports = simpleGit;
module.exports.simpleGit = simpleGit;
module.exports.default = simpleGit;
