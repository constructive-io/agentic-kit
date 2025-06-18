global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

jest.mock('undici', () => ({
  request: jest.fn(),
}));
