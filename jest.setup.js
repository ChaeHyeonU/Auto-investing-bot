import '@testing-library/jest-dom'

// Jest setup for Node.js environment polyfills
global.setImmediate = global.setImmediate || ((fn, ...args) => global.setTimeout(fn, 0, ...args));
global.clearImmediate = global.clearImmediate || global.clearTimeout;