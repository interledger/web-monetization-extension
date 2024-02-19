import '@testing-library/jest-dom'

import { chrome } from 'jest-chrome'

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  callback: ResizeObserverCallback
}

global.ResizeObserver = ResizeObserverMock

Object.assign(global, { chrome: chrome, browser: chrome })
