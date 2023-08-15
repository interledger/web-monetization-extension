import { BrowserAPI } from '@/lib/index'
import {
  addMessageListener,
  queryActiveTab,
  sendRuntimeMessage,
  sendTabsMessage,
} from '@/lib/messageUtils'

describe('messageUtils', () => {
  let originalBrowser

  // Store the original global browser object
  beforeAll(() => {
    originalBrowser = global.browser
  })

  // Restore the original global browser object after all tests
  afterAll(() => {
    global.browser = originalBrowser
  })

  // Clear mock function calls after each test
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('sendTabsMessage', () => {
    it('should send tabs message and return true', () => {
      const message = { action: 'ACTION', content: 'test' }
      const tabId = 123
      const callback = jest.fn()

      // Call the sendTabsMessage function
      const result = sendTabsMessage(message, tabId, callback)

      // Check if BrowserAPI.tabs.sendMessage was called with the expected arguments
      expect(BrowserAPI.tabs.sendMessage).toHaveBeenCalledWith(tabId, message, callback)
      // Check if the result is true
      expect(result).toBe(true)
    })
  })

  describe('sendRuntimeMessage', () => {
    it('should send runtime message with action and payload', () => {
      const action = 'ACTION'
      const payload = { data: 'payload' }
      const callback = jest.fn()

      // Call the sendRuntimeMessage function
      sendRuntimeMessage(action, payload, callback)

      // Check if BrowserAPI.runtime.sendMessage was called with the expected arguments
      expect(BrowserAPI.runtime.sendMessage).toHaveBeenCalledWith(
        { type: action, content: payload },
        callback,
      )
    })
  })

  describe('addMessageListener', () => {
    it('should add message listener and call the provided callback', () => {
      const listener = jest.fn()
      const addListenerMock = jest.fn()

      // Mock the runtime.onMessage.addListener function
      BrowserAPI.runtime.onMessage = {
        addListener: addListenerMock,
      }

      // Call the addMessageListener function
      addMessageListener(listener)

      // Check if BrowserAPI.runtime.onMessage.addListener was called with the expected argument
      expect(addListenerMock).toHaveBeenCalledWith(listener)
    })

    it('adds message listener and calls the provided callback', () => {
      const listenerMock = jest.fn()
      // Call the addMessageListener function
      addMessageListener(listenerMock)

      // Check if BrowserAPI.runtime.onMessage.addListener was called with an anonymous function
      expect(BrowserAPI.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function))
      const addedListener = BrowserAPI.runtime.onMessage.addListener.mock.calls[0][0]

      // Simulate the listener being called
      const sendResponseMock = jest.fn()
      addedListener({ action: 'GET_MONETIZATION' }, {}, sendResponseMock)

      // Check if the listenerMock was called with the expected arguments
      expect(listenerMock).toHaveBeenCalledWith(
        { action: 'GET_MONETIZATION' },
        {},
        sendResponseMock,
      )
    })
  })

  describe('queryActiveTab', () => {
    it('should query active tab and call the callback with the active tab', () => {
      const activeTab = { id: 123 }
      const callback = jest.fn()
      const tabsMock = { query: jest.fn((_, cb) => cb([activeTab])) }

      // Mock BrowserAPI.tabs with tabsMock
      BrowserAPI.tabs = tabsMock

      // Call the queryActiveTab function
      queryActiveTab(callback)

      // Check if the callback was called with the activeTab
      expect(callback).toHaveBeenCalledWith(activeTab)
      // Check if BrowserAPI.tabs.query was called with the expected arguments
      expect(tabsMock.query).toHaveBeenCalledWith(
        { active: true, currentWindow: true },
        expect.any(Function),
      )
    })
  })
})
