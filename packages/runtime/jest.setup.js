global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

jest.mock('execa', () => jest.fn());
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));
