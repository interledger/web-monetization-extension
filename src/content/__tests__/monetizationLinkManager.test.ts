import { JSDOM } from 'jsdom';
import { MonetizationLinkManager } from '@/content/services/monetizationLinkManager';
import type {
  ContentToBackgroundMessage,
  MessageManager,
  Response,
} from '@/shared/messages';
import { success, failure } from '@/shared/helpers';
import type { Logger } from '@/shared/logger';
import type { WalletAddress } from '@interledger/open-payments';

// for syntax highlighting
const html = String.raw;

const WALLET_ADDRESS: WalletAddress[] = [
  {
    authServer: 'https://auth.example.com',
    publicName: 'Test Wallet USD',
    assetCode: 'USD',
    assetScale: 2,
    id: '',
    resourceServer: '',
  },
  {
    authServer: 'https://auth2.example.com',
    publicName: 'Test Wallet EUR',
    assetCode: 'EUR',
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
  const requestIdMock = jest.fn(() => `request-${Math.random()}`);

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
    // @ts-expect-error let it go
    global.crypto.randomUUID = requestIdMock;
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

    const walletAddressInfoRequestId =
      requestIdMock.mock.results[requestIdMock.mock.calls.length - 1].value;
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
        requestId: walletAddressInfoRequestId,
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
    const iframeId = requestIdMock.mock.results[0].value;
    jest.spyOn(doc, 'readyState', 'get').mockReturnValue('interactive');
    jest
      .spyOn(iframeDocument, 'readyState', 'get')
      .mockReturnValue('interactive');

    linkManager.start();

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        message: 'INITIALIZE_IFRAME',
        id: iframeId,
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

    const walletAddressInfoRequestId =
      requestIdMock.mock.results[requestIdMock.mock.calls.length - 1].value;

    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEventSpy.mock.calls[0][0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);

    expect(dispatchEventSpy.mock.instances[0]).toBe(link);

    expect(postMessageSpy).toHaveBeenNthCalledWith(
      2,
      {
        id: iframeId,
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          {
            requestId: walletAddressInfoRequestId,
            walletAddress: WALLET_ADDRESS[0],
          },
        ],
      },
      '*',
    );

    const messageEvent = new iframeWindow.MessageEvent('message', {
      data: {
        message: 'START_MONETIZATION',
        id: iframeId,
        payload: [
          {
            requestId: walletAddressInfoRequestId,
            walletAddress: WALLET_ADDRESS[0],
          },
        ],
      },
    });

    iframeWindow.dispatchEvent(messageEvent);

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddressInfoRequestId,
        walletAddress: WALLET_ADDRESS[0],
      },
    ]);
  });

  test('should handle monetization link element removal', async () => {
    const { document, documentReadyState } = createTestEnv({
      head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
    });

    const linkManager = createMonetizationLinkManager(document);
    documentReadyState.mockReturnValue('interactive');

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_ADDRESS[0]),
    );

    linkManager.start();

    await new Promise(process.nextTick);

    const walletAddressInfoRequestId = requestIdMock.mock.results[1].value;
    const link = document.querySelector('link[rel="monetization"]')!;
    link.remove();

    await new Promise(process.nextTick);

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddressInfoRequestId,
        intent: 'remove',
      },
    ]);
  });

  test('should handle monetization link href attribute change', async () => {
    const { document, documentReadyState } = createTestEnv({
      head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
    });

    const linkManager = createMonetizationLinkManager(document);
    documentReadyState.mockReturnValue('interactive');

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_ADDRESS[0]),
    ).mockResolvedValueOnce(success(WALLET_ADDRESS[1]));

    linkManager.start();

    await new Promise(process.nextTick);

    const walletAddressInfoRequestId = requestIdMock.mock.results[1].value;
    const link = document.querySelector(
      'link[rel="monetization"]',
    )! as HTMLLinkElement;
    link.href = 'https://ilp.interledger-test.dev/new';

    await new Promise(process.nextTick);

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddressInfoRequestId,
        intent: 'remove',
      },
    ]);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: 'https://ilp.interledger-test.dev/new',
    });

    await new Promise(process.nextTick);

    const newWalletAddressInfoRequestId =
      requestIdMock.mock.results[requestIdMock.mock.calls.length - 1].value;
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      {
        requestId: newWalletAddressInfoRequestId,
        walletAddress: WALLET_ADDRESS[1],
      },
    ]);
  });

  test('should handle monetization link disabled attribute change', async () => {
    const { document, documentReadyState } = createTestEnv({
      head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
    });

    const linkManager = createMonetizationLinkManager(document);
    documentReadyState.mockReturnValue('interactive');

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_ADDRESS[0]),
    );

    linkManager.start();

    await new Promise(process.nextTick);

    const walletAddressInfoRequestId = requestIdMock.mock.results[1].value;
    const link = document.querySelector('link[rel="monetization"]')!;
    link.setAttribute('disabled', '');

    await new Promise(process.nextTick);

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddressInfoRequestId,
        intent: 'disable',
      },
    ]);

    // remove disabled attribute
    link.removeAttribute('disabled');

    await new Promise(process.nextTick);

    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      {
        requestId: walletAddressInfoRequestId,
        walletAddress: WALLET_ADDRESS[0],
      },
    ]);
  });

  test.todo('should handle monetization link rel attribute change');

  test('should handle document visibility change event', async () => {
    const { document, window, documentReadyState } = createTestEnv({
      head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
    });

    const linkManager = createMonetizationLinkManager(document);
    documentReadyState.mockReturnValue('interactive');

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_ADDRESS[0]),
    );

    linkManager.start();

    await new Promise(process.nextTick);

    const walletAddressInfoRequestId = requestIdMock.mock.results[1].value;
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    });
    document.dispatchEvent(new window.Event('visibilitychange'));

    await new Promise(process.nextTick);

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddressInfoRequestId,
      },
    ]);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    document.dispatchEvent(new window.Event('visibilitychange'));

    expect(msg.RESUME_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddressInfoRequestId,
      },
    ]);
  });

  test.todo('should handle pagehide event');

  test('should handle multiple monetization links', async () => {
    const { document, documentReadyState } = createTestEnv({
      head: html`
        <link rel="monetization" href="https://ilp.interledger-test.dev/tech1">
        <link rel="monetization" href="https://ilp.interledger-test.dev/tech2">
      `,
    });

    const linkManager = createMonetizationLinkManager(document);
    documentReadyState.mockReturnValue('interactive');

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_ADDRESS[0]),
    ).mockResolvedValueOnce(success(WALLET_ADDRESS[1]));

    linkManager.start();

    await new Promise(process.nextTick);

    const walletAddress1InfoRequestId = requestIdMock.mock.results[1].value;
    const walletAddress2InfoRequestId = requestIdMock.mock.results[2].value;
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(1, {
      walletAddressUrl: 'https://ilp.interledger-test.dev/tech1',
    });
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: 'https://ilp.interledger-test.dev/tech2',
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddress1InfoRequestId,
        walletAddress: WALLET_ADDRESS[0],
      },
      {
        requestId: walletAddress2InfoRequestId,
        walletAddress: WALLET_ADDRESS[1],
      },
    ]);
  });

  test('should handle invalid wallet address URL', async () => {
    const { document, documentReadyState } = createTestEnv({
      head: html`<link rel="monetization" href="invalid-url">`,
    });
    const link = document.querySelector('link[rel="monetization"]')!;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const linkManager = createMonetizationLinkManager(document);
    documentReadyState.mockReturnValue('interactive');

    msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
      failure('Could not retrieve wallet address information'),
    );

    linkManager.start();

    await new Promise(process.nextTick);

    // should dispatch error event
    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('error'));
    expect(loggerMock.error).toHaveBeenCalled();

    // should not start monetization
    expect(msg.START_MONETIZATION).not.toHaveBeenCalledWith(
      'START_MONETIZATION',
      expect.any(Array),
    );
  });

  test.todo('should handle dynamically added monetization link');
});
