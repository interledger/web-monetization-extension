import { JSDOM } from 'jsdom';
import { MonetizationLinkManager } from '@/content/services/monetizationLinkManager';
import type {
  ContentToBackgroundMessage,
  MessageManager,
} from '@/shared/messages';
import type { Logger } from '@/shared/logger';
import type { Browser } from 'webextension-polyfill';

// for syntax highlighting
const html = String.raw;

describe('MonetizationLinkManager', () => {
  let loggerMock: Logger;
  let messageMock: MessageManager<ContentToBackgroundMessage>;
  let monetizationManager: MonetizationLinkManager;
  let dispatchEventSpy: jest.SpyInstance;

  function createTestEnv({
    head = '',
    body = '',
  }: { head?: string; body?: string }) {
    const dom = new JSDOM(
      html`<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`,
      {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        resources: 'usable',
      },
    );

    return {
      dom,
      window: dom.window,
      document: dom.window.document,
    };
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
    const { window, document } = createTestEnv({
      head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
    });
    const link = document.querySelector('link[rel="monetization"]')!;
    dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    monetizationManager = new MonetizationLinkManager({
      window: window as unknown as Window,
      global: document.defaultView!.globalThis,
      document: document,
      logger: loggerMock,
      message: messageMock,
    });
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');

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
    const { document: doc } = createTestEnv({
      body: html`<iframe id="testFrame"></iframe>`,
    });
    const iframe = doc.getElementsByTagName('iframe')[0];
    const iframeDocument = iframe.contentDocument!;
    iframeDocument.head.insertAdjacentHTML(
      'afterbegin',
      html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
    );
    const iframeWindow = iframe.contentWindow!.window;

    const link = iframeDocument.querySelector('link[rel="monetization"]')!;
    dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const postMessageSpy = jest.spyOn(iframeWindow.parent, 'postMessage');

    monetizationManager = new MonetizationLinkManager({
      window: iframeWindow as unknown as Window,
      document: iframeDocument,
      global: iframeWindow.globalThis,
      logger: loggerMock,
      message: messageMock,
    });
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');

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
