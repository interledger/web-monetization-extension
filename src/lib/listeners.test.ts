import { initListeners } from '@/lib/index'
import { addTabChangeListener } from '@/lib/listeners'
import { addMessageListener, sendRuntimeMessage } from '@/lib/messageUtils'

// Mock the addMessageListener and sendRuntimeMessage functions
jest.mock('@/lib/messageUtils', () => ({
  addMessageListener: jest.fn(),
  sendRuntimeMessage: jest.fn(),
}))

// Mock browser.tabs.onActivated listener
const onActivatedMock = jest.fn()
const tabsMock = {
  onActivated: {
    addListener: onActivatedMock,
  },
}
// Mock the browser object with the tabsMock
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).browser = {
  tabs: tabsMock,
}

describe('initListeners', () => {
  // Set up the HTML body before each test
  beforeEach(() => {
    document.body.innerHTML = `
      <link rel="monetization" href="https://example.com/payment" />
    `
  })

  // Clean up the HTML body and mock function calls after each test
  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  it('sends MONETIZATION_START message if monetization link exists', () => {
    initListeners()

    expect(sendRuntimeMessage).toHaveBeenCalledWith('MONETIZATION_START', true)
  })

  it('sends MONETIZATION_START message with false if monetization link does not exist', () => {
    document.body.innerHTML = ''
    initListeners()

    expect(sendRuntimeMessage).toHaveBeenCalledWith('MONETIZATION_START', false)
  })

  it('listens for GET_MONETIZATION message and responds with monetization link status', () => {
    // Mock addMessageListener function
    const addMessageListenerMock = addMessageListener as jest.Mock
    addMessageListenerMock.mockImplementation(listener => {
      const sendResponseMock = jest.fn()
      const sender = {}

      listener({ action: 'GET_MONETIZATION' }, sender, sendResponseMock)

      expect(sendResponseMock).toHaveBeenCalledWith(true)
    })

    initListeners()
  })

  it('sends MONETIZATION_START message based on link existence', () => {
    // Monetization link exists
    document.body.innerHTML = '<link rel="monetization" href="https://example.com/payment" />'
    const sendResponseMock = jest.fn()
    const sender = {}

    const addMessageListenerMock = addMessageListener as jest.Mock
    addMessageListenerMock.mockImplementation(listener => {
      listener({ action: 'GET_MONETIZATION' }, sender, sendResponseMock)
    })

    initListeners()

    expect(sendResponseMock).toHaveBeenCalledWith(true)

    // Monetization link does not exist
    document.body.innerHTML = ''
    sendResponseMock.mockClear()

    initListeners()

    expect(sendResponseMock).toHaveBeenCalledWith(false)
  })
})

describe('addTabChangeListener', () => {
  it('registers tab change listener', () => {
    const listenerMock = jest.fn()
    tabsMock.onActivated.addListener.mockImplementation(callback => {
      callback({ tabId: 123, windowId: 456 })

      expect(listenerMock).toHaveBeenCalled()
    })

    addTabChangeListener(listenerMock)
  })

  it('registers tab change listener and handles failure', () => {
    // Mock addMessageListener function
    const addMessageListenerMock = addMessageListener as jest.Mock
    addMessageListenerMock.mockImplementation(listener => {
      const sendResponseMock = jest.fn()
      const sender = {}

      listener({ action: 'GET_MONETIZATION' }, sender, sendResponseMock)

      expect(sendResponseMock).toHaveBeenCalledWith(false)
    })

    // Simulate tab change listener registration failure
    tabsMock.onActivated.addListener = jest.fn(() => {
      throw new Error('Listener registration failed')
    })

    // Ensure that no errors are thrown when initListeners is called
    expect(() => initListeners()).not.toThrow()
  })
})
