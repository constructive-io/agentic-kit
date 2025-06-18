const mockFiles = new Map();

const promises = {
  readFile: jest.fn((path, encoding) => {
    if (mockFiles.has(path)) {
      return Promise.resolve(mockFiles.get(path));
    }
    if (path === 'package.json') {
      return Promise.resolve('{"name": "@agentic-kit/tools"}');
    }
    if (path.includes('/tmp/search-test.txt')) {
      return Promise.resolve('This is a test document with some sample text for searching.');
    }
    if (path.includes('/tmp/regex-test.txt')) {
      return Promise.resolve('function testFunction() {\n  return "hello world";\n}');
    }
    if (path.includes('/tmp/integration-test.txt')) {
      return Promise.resolve('This is integration test content with multiple lines.\nSecond line for testing.\nThird line with more content.');
    }
    if (path.includes('/tmp/')) {
      return Promise.resolve('This is a test document with some sample text for searching.');
    }
    return Promise.reject(new Error(`ENOENT: no such file or directory, open '${path}'`));
  }),
  
  writeFile: jest.fn((path, content) => {
    mockFiles.set(path, content);
    return Promise.resolve();
  }),
  
  readdir: jest.fn((path, options) => {
    if (path === '.') {
      return Promise.resolve([
        { name: 'package.json', isFile: () => true, isDirectory: () => false },
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: '__tests__', isFile: () => false, isDirectory: () => true }
      ]);
    }
    return Promise.resolve([]);
  }),
  
  stat: jest.fn((path) => {
    if (path === 'package.json' || mockFiles.has(path) || path.includes('/tmp/')) {
      return Promise.resolve({ isFile: () => true, isDirectory: () => false });
    }
    return Promise.reject(new Error(`ENOENT: no such file or directory, stat '${path}'`));
  })
};

module.exports = {
  promises,
  default: { promises }
};

module.exports.promises = promises;
