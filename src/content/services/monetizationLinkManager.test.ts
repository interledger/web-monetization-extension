/**  @jest-environment jsdom */
import { MonetizationLinkManager } from './monetizationLinkManager';
import type {
  ContentToBackgroundMessage,
  MessageManager,
} from '@/shared/messages';
import type { Logger } from '@/shared/logger';
import type { Browser } from 'webextension-polyfill';

describe('MonetizationLinkManager', () => {
  let dom: Document;
  let windowMock: Window;
  let loggerMock: Logger;
  let messageMock: MessageManager<ContentToBackgroundMessage>;
  let monetizationManager: MonetizationLinkManager;
  let dispatchEventSpy: jest.SpyInstance;

  const createIframeLink = () => {
    // TO DO: need to find a way to create an iframe link
  };

  const createLink = () => {
    const link = dom.createElement('link');
    link.rel = 'monetization';
    link.href = 'https://ilp.interledger-test.dev/59ce7018';
    // create a spy for dispatchEvent
    dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    dom.head.appendChild(link);
    return link;
  };

  beforeEach(() => {
    // mock crypto.randomUUID for requestId
    global.crypto.randomUUID = jest.fn(
      () => '123e4567-e89b-12d3-a456-426614174000',
    );

    messageMock = {
      send: jest.fn().mockResolvedValueOnce({
        success: true,
        payload: {
          authServer: 'https://auth.example.com',
          publicName: 'Test Wallet',
        },
      }),
      sendToTab: jest.fn(),
      sendToActiveTab: jest.fn(),
      browser: {} as unknown as Browser,
    } as unknown as jest.Mocked<MessageManager<ContentToBackgroundMessage>>;
    // create a mock document using JSDOM
    dom = document.implementation.createHTMLDocument();
    windowMock = global.window;
    loggerMock = {
      error: jest.fn(),
    } as unknown as Logger;
  });

  afterEach(() => {
    jest.clearAllMocks();
    dispatchEventSpy.mockRestore();
    monetizationManager.end();
  });

  test('should detect monetization link tags', async () => {
    // insert a mock monetization link into the document
    const link = createLink();
    Object.defineProperty(dom, 'readyState', {
      get() {
        return 'interactive';
      },
    });

    Object.defineProperty(dom, 'visibilityState', {
      get() {
        return 'visible';
      },
    });

    monetizationManager = new MonetizationLinkManager({
      window: windowMock,
      document: dom,
      logger: loggerMock,
      message: messageMock,
    });

    monetizationManager.start();

    // @ts-ignore - accessing private property for testing
    expect(monetizationManager.isTopFrame).toBe(true);
    // @ts-ignore
    expect(monetizationManager.isFirstLevelFrame).toBe(true);

    expect(messageMock.send).toHaveBeenCalledTimes(1);
    expect(messageMock.send).toHaveBeenCalledWith('GET_WALLET_ADDRESS_INFO', {
      walletAddressUrl: 'https://ilp.interledger-test.dev/59ce7018',
    });

    // wait for check link validation to complete
    await new Promise(process.nextTick);

    // check if dispatchEvent was called with a 'load' event
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
    const dispatchedLoadEvent = dispatchEventSpy.mock.calls[0][0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');

    // event was dispatched on our link element
    expect(dispatchEventSpy.mock.instances[0]).toBe(link);

    expect(messageMock.send).toHaveBeenCalledTimes(2);
    // second call should be START_MONETIZATION with the right payload
    expect(messageMock.send).toHaveBeenNthCalledWith(2, 'START_MONETIZATION', [
      {
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        walletAddress: {
          authServer: 'https://auth.example.com',
          publicName: 'Test Wallet',
        },
      },
    ]);
  });

  test('should detect link when running in first-level iframe', async () => {
    const link = createIframeLink();

    // create mock top window that's different from current window
    const mockTopWindow = { ...windowMock };

    // setup window to simulate first level iframe (parent is top, but current window is not top)
    Object.defineProperty(windowMock, 'top', {
      get: () => mockTopWindow,
    });
    Object.defineProperty(windowMock, 'parent', {
      get: () => mockTopWindow,
    });

    Object.defineProperty(dom, 'readyState', {
      get() {
        return 'interactive';
      },
    });
    dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');
    Object.defineProperty(dom, 'visibilityState', {
      get() {
        return 'visible';
      },
    });

    monetizationManager = new MonetizationLinkManager({
      window: windowMock,
      document: dom,
      logger: loggerMock,
      message: messageMock,
    });

    monetizationManager.start();

    // @ts-ignore - accessing private property for testing
    expect(monetizationManager.isTopFrame).toBe(false);
    // @ts-ignore
    expect(monetizationManager.isFirstLevelFrame).toBe(true);

    expect(messageMock.send).toHaveBeenCalledWith('GET_WALLET_ADDRESS_INFO', {
      walletAddressUrl: 'https://ilp.interledger-test.dev/darianusd',
    });

    expect(messageMock.send).toHaveBeenNthCalledWith(2, 'START_MONETIZATION', [
      {
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        walletAddress: 'https://ilp.interledger-test.dev/darianusd',
      },
    ]);

    await new Promise(process.nextTick);

    expect(messageMock.send).toHaveBeenCalledTimes(2);
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
    const dispatchedLoadEvent = dispatchEventSpy.mock.calls[0][0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');

    expect(windowMock.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );

    expect(windowMock.parent.postMessage).toHaveBeenCalledWith(
      {
        message: 'INITIALIZE_IFRAME',
        id: '123e4567-e89b-12d3-a456-426614174000',
        payload: undefined,
      },
      '*',
    );
  });
});
