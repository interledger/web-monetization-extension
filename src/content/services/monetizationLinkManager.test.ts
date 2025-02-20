/**  @jest-environment jsdom */
import { MonetizationLinkManager } from './monetizationLinkManager';
import type {
  ContentToBackgroundMessage,
  MessageManager,
} from '@/shared/messages';
import type { Logger } from '@/shared/logger';
import type { Browser } from 'webextension-polyfill';
import { TextEncoder, TextDecoder } from 'node:util';
Object.assign(global, { TextDecoder, TextEncoder });
import { JSDOM, type DOMWindow } from 'jsdom';

describe('MonetizationLinkManager', () => {
  let loggerMock: Logger;
  let messageMock: MessageManager<ContentToBackgroundMessage>;
  let monetizationManager: MonetizationLinkManager;
  let dispatchEventSpy: jest.SpyInstance;

  function createTestEnv(html: string) {
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    });
    return {
      window: dom.window,
      document: dom.window.document,
    };
  }

  function appendCreateLink(dom: DOMWindow) {
    const link = dom.document.createElement('link');
    link.rel = 'monetization';
    link.href = 'https://ilp.interledger-test.dev/tech';
    // create a spy for dispatchEvent
    dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    dom.document.head.appendChild(link);
    return link;
  }

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
    const { window, document } = createTestEnv(`<!DOCTYPE html>
      <html>
        <head></head>
        <body></body>
      </html>
    `);
    const link = appendCreateLink(window);

    // mock the MutationObserver constructor and Event
    // https://stackoverflow.com/questions/76242504/mutationobserver-in-jsdom-fails-because-parameter-1-is-not-of-type-node
    // https://github.com/jsdom/jsdom/issues/3331
    jest.spyOn(globalThis, 'MutationObserver').mockImplementation((...args) => {
      return new window.MutationObserver(...args);
    });
    jest
      .spyOn(globalThis, 'Event')
      .mockImplementation((...args) => new window.Event(args[0], args[1]));
    // set global HTMLLinkElement
    global.HTMLLinkElement = window.HTMLLinkElement;

    Object.defineProperty(document, 'readyState', {
      get() {
        return 'interactive';
      },
    });

    monetizationManager = new MonetizationLinkManager({
      window: window as unknown as Window,
      document: document,
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
      walletAddressUrl: 'https://ilp.interledger-test.dev/tech',
    });

    // wait for check link validation to complete
    await new Promise(process.nextTick);

    // check if dispatchEvent was called with a 'load' event
    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEventSpy.mock.calls[0][0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');

    // event was dispatched on correct link element
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
    const { document: dom } = createTestEnv(`<!DOCTYPE html>
  <html>
    <head></head>
    <body>
      <iframe id="testFrame">
        <html>
          <head></head>
          <body></body>
        </html>
      </iframe>
    </body>
  </html>`);

    const iframe = dom.getElementById('testFrame') as HTMLIFrameElement;
    const iframeWindow = iframe.contentWindow!.window;
    const iframeDocument = iframe.contentDocument!;
    const link = appendCreateLink(iframeWindow as unknown as DOMWindow);

    global.HTMLLinkElement = iframeWindow.HTMLLinkElement;

    dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const postMessageSpy = jest.spyOn(iframeWindow.parent, 'postMessage');

    // mock the MutationObserver constructor
    jest.spyOn(globalThis, 'MutationObserver').mockImplementation((...args) => {
      return new iframeWindow.MutationObserver(...args);
    });
    jest
      .spyOn(globalThis, 'Event')
      .mockImplementation(
        (...args) => new iframeWindow.Event(args[0], args[1]),
      );

    Object.defineProperty(dom, 'readyState', {
      get() {
        return 'interactive';
      },
    });

    monetizationManager = new MonetizationLinkManager({
      window: iframeWindow as unknown as Window,
      document: iframeDocument,
      logger: loggerMock,
      message: messageMock,
    });

    monetizationManager.start();

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        message: 'INITIALIZE_IFRAME',
        id: '123e4567-e89b-12d3-a456-426614174000',
        payload: undefined,
      },
      '*',
    );

    // @ts-ignore - accessing private property for testing
    expect(monetizationManager.isTopFrame).toBe(false);
    // @ts-ignore
    expect(monetizationManager.isFirstLevelFrame).toBe(true);

    expect(messageMock.send).toHaveBeenCalledTimes(1);
    expect(messageMock.send).toHaveBeenCalledWith('GET_WALLET_ADDRESS_INFO', {
      walletAddressUrl: 'https://ilp.interledger-test.dev/tech',
    });

    await new Promise(process.nextTick);

    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEventSpy.mock.calls[0][0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');

    expect(dispatchEventSpy.mock.instances[0]).toBe(link);

    expect(postMessageSpy).toHaveBeenNthCalledWith(
      2,
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          {
            requestId: '123e4567-e89b-12d3-a456-426614174000',
            walletAddress: {
              authServer: 'https://auth.example.com',
              publicName: 'Test Wallet',
            },
          },
        ],
      },
      '*',
    );
  });
});
