import { JSDOM } from 'jsdom';
import { MonetizationLinkManager } from '@/content/services/monetizationLinkManager';
import type {
  ContentToBackgroundMessage,
  MessageManager,
  Response,
} from '@/shared/messages';
import { success } from '@/shared/helpers';
import type { Logger } from '@/shared/logger';
import type { WalletAddress } from '@interledger/open-payments';

// for syntax highlighting
const html = String.raw;

const WALLET_ADDRESS: WalletAddress[] = [
  {
    authServer: 'https://auth.example.com',
    publicName: 'Test Wallet',
    assetCode: 'USD',
    assetScale: 2,
    id: '',
    resourceServer: '',
  },
];

describe('MonetizationLinkManager', () => {
  const messageManager = {
    send: () => {},
  } as unknown as MessageManager<ContentToBackgroundMessage>;
  const loggerMock = {
    error: jest.fn(),
  } as unknown as Logger;

  const msg: {
    [k in keyof ContentToBackgroundMessage]: jest.Mock<
      Promise<Response<ContentToBackgroundMessage[k]['output']>>,
      [ContentToBackgroundMessage[k]['input']]
    >;
  } = {
    GET_WALLET_ADDRESS_INFO: jest.fn(),
    RESUME_MONETIZATION: jest.fn(),
    START_MONETIZATION: jest.fn(),
    STOP_MONETIZATION: jest.fn(),
    TAB_FOCUSED: jest.fn(),
  };
  const messageMock = jest.spyOn(messageManager, 'send');
  // @ts-expect-error let it go
  messageMock.mockImplementation((action, payload) => msg[action](payload));

  function createMonetizationLinkManager(document: Document) {
    const linkManager = new MonetizationLinkManager({
      global: document.defaultView!.globalThis,
      document: document,
      message: messageManager,
      logger: loggerMock,
    });

    return linkManager;
  }

  function createTestEnv({
    head = '',
    body = '',
  }: { head?: string; body?: string }) {
    const htm = html`<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
    const dom = new JSDOM(htm, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    const window = dom.window;
    const document = window.document;

    return {
      dom,
      window,
      document,
      documentReadyState: jest.spyOn(document, 'readyState', 'get'),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // mock crypto.randomUUID for requestId
    global.crypto.randomUUID = jest.fn(
      () => '123e4567-e89b-12d3-a456-426614174000',
    );
  });

  test('should detect monetization link tags', async () => {
    const { document, documentReadyState } = createTestEnv({
      head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
    });
    const link = document.querySelector('link[rel="monetization"]')!;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const linkManager = createMonetizationLinkManager(document);
    documentReadyState.mockReturnValue('interactive');

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_ADDRESS[0]),
    );

    linkManager.start();

    // @ts-ignore - accessing private property for testing
    expect(linkManager.isTopFrame).toBe(true);
    // @ts-ignore
    expect(linkManager.isFirstLevelFrame).toBe(true);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(1);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: 'https://ilp.interledger-test.dev/tech',
    });

    // wait for check link validation to complete
    await new Promise(process.nextTick);

    // check if dispatchEvent was called with a 'load' event
    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEventSpy.mock.calls[0][0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);

    // event was dispatched on correct link element
    expect(dispatchEventSpy.mock.instances[0]).toBe(link);

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        walletAddress: WALLET_ADDRESS[0],
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

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_ADDRESS[0]),
    );

    const link = iframeDocument.querySelector('link[rel="monetization"]')!;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const postMessageSpy = jest.spyOn(iframeWindow.parent, 'postMessage');
    const linkManager = createMonetizationLinkManager(iframeDocument);
    jest.spyOn(doc, 'readyState', 'get').mockReturnValue('interactive');
    jest
      .spyOn(iframeDocument, 'readyState', 'get')
      .mockReturnValue('interactive');

    linkManager.start();

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        message: 'INITIALIZE_IFRAME',
        id: '123e4567-e89b-12d3-a456-426614174000',
        payload: undefined,
      },
      '*',
    );

    // @ts-ignore - accessing private property for testing
    expect(linkManager.isTopFrame).toBe(false);
    // @ts-ignore
    expect(linkManager.isFirstLevelFrame).toBe(true);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(1);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: 'https://ilp.interledger-test.dev/tech',
    });

    await new Promise(process.nextTick);

    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEventSpy.mock.calls[0][0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);

    expect(dispatchEventSpy.mock.instances[0]).toBe(link);

    expect(postMessageSpy).toHaveBeenNthCalledWith(
      2,
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          {
            requestId: '123e4567-e89b-12d3-a456-426614174000',
            walletAddress: WALLET_ADDRESS[0],
          },
        ],
      },
      '*',
    );

    const messageEvent = new iframeWindow.MessageEvent('message', {
      data: {
        message: 'START_MONETIZATION',
        id: '123e4567-e89b-12d3-a456-426614174000',
        payload: [
          {
            requestId: '123e4567-e89b-12d3-a456-426614174000',
            walletAddress: WALLET_ADDRESS[0],
          },
        ],
      },
    });

    iframeWindow.dispatchEvent(messageEvent);

    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: '123e4567-e89b-12d3-a456-426614174000',
        walletAddress: WALLET_ADDRESS[0],
      },
    ]);
  });
});
