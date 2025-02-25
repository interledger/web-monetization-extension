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
  {
    authServer: 'https://auth3.example.com',
    publicName: 'Test Wallet MXN',
    assetCode: 'MXN',
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
    // biome-ignore lint/complexity/noForEach: <explanation>
    Object.values(msg).forEach((m) => m.mockReset());

    // mock crypto.randomUUID for requestId
    // @ts-expect-error let it go
    global.crypto.randomUUID = requestIdMock;
  });

  describe('monetization in main frame', () => {
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

    test('should handle parent of link tag getting removed, then an element containing link tag added back dynamically', async () => {
      const { document, documentReadyState } = createTestEnv({
        head: html`<div id="container"><link rel="monetization" href="https://ilp.interledger-test.dev/tech"></div>`,
      });

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      ).mockResolvedValueOnce(success(WALLET_ADDRESS[0]));

      linkManager.start();

      await new Promise(process.nextTick);

      const initialRequestId = requestIdMock.mock.results[1].value;
      const container = document.getElementById('container')!;
      container.remove();

      await new Promise(process.nextTick);

      expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: initialRequestId,
          intent: 'remove',
        },
      ]);

      // add a new container with the same link
      const newContainer = document.createElement('div');
      newContainer.innerHTML =
        '<link rel="monetization" href="https://ilp.interledger-test.dev/tech">';
      document.head.appendChild(newContainer);

      await new Promise(process.nextTick);

      const newRequestId = requestIdMock.mock.results[2].value;
      expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: newRequestId,
          walletAddress: WALLET_ADDRESS[0],
        },
      ]);
    });

    test('should handle two monetization link tags', async () => {
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

      expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('error'));
      expect(loggerMock.error).toHaveBeenCalled();

      expect(msg.START_MONETIZATION).not.toHaveBeenCalledWith(
        expect.any(Array),
      );
    });

    test('should handle dynamically added monetization link in top frame', async () => {
      const { document, documentReadyState } = createTestEnv({});

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      );

      linkManager.start();

      // add monetization link after initialization
      const link = document.createElement('link');
      link.rel = 'monetization';
      link.href = 'https://ilp.interledger-test.dev/tech';
      document.head.appendChild(link);

      await new Promise(process.nextTick);

      expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
        walletAddressUrl: 'https://ilp.interledger-test.dev/tech',
      });

      const walletAddressInfoRequestId = requestIdMock.mock.results[1].value;
      expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: walletAddressInfoRequestId,
          walletAddress: WALLET_ADDRESS[0],
        },
      ]);
    });

    test('should handle two link tags added simultaneously; like first tag fires a single mutation callback, but in other added tag its fired twice', async () => {
      const { document, documentReadyState } = createTestEnv({});

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      ).mockResolvedValueOnce(success(WALLET_ADDRESS[1]));

      linkManager.start();

      // create and add two monetization links simultaneously
      const link1 = document.createElement('link');
      link1.rel = 'monetization';
      link1.href = 'https://ilp.interledger-test.dev/tech1';

      const link2 = document.createElement('link');
      link2.rel = 'monetization';
      link2.href = 'https://ilp.interledger-test.dev/tech2';

      // append both links in quick succession
      document.head.appendChild(link1);
      document.head.appendChild(link2);

      // simulate multiple mutation callbacks for the second link
      // by triggering an additional attribute change
      link2.setAttribute('crossorigin', 'anonymous');

      await new Promise(process.nextTick);

      const walletAddress1RequestId = requestIdMock.mock.results[1].value;
      const walletAddress2RequestId = requestIdMock.mock.results[2].value;

      expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(2);
      expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(1, {
        walletAddressUrl: 'https://ilp.interledger-test.dev/tech1',
      });
      expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
        walletAddressUrl: 'https://ilp.interledger-test.dev/tech2',
      });

      expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
      expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: walletAddress1RequestId,
          walletAddress: WALLET_ADDRESS[0],
        },
        {
          requestId: walletAddress2RequestId,
          walletAddress: WALLET_ADDRESS[1],
        },
      ]);

      // verify that both links are being observed for attribute changes
      link1.href = 'https://ilp.interledger-test.dev/tech1-updated';
      await new Promise(process.nextTick);

      expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: walletAddress1RequestId,
          intent: 'remove',
        },
      ]);
    });

    test('should handle element with link tag append and removal', async () => {
      const { document, documentReadyState } = createTestEnv({});

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      );

      linkManager.start();

      const wrapper = document.createElement('div');
      wrapper.innerHTML =
        '<link rel="monetization" href="https://ilp.interledger-test.dev/tech">';
      document.head.appendChild(wrapper);

      await new Promise(process.nextTick);

      const requestId = requestIdMock.mock.results[1].value;
      expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId,
          walletAddress: WALLET_ADDRESS[0],
        },
      ]);

      wrapper.remove();

      await new Promise(process.nextTick);

      expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId,
          intent: 'remove',
        },
      ]);
    });

    test('more link tags added right after, leading to another mutation', async () => {
      const { document, documentReadyState } = createTestEnv({});

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      )
        .mockResolvedValueOnce(success(WALLET_ADDRESS[1]))
        .mockResolvedValueOnce(success(WALLET_ADDRESS[2]));

      linkManager.start();

      const link1 = document.createElement('link');
      link1.rel = 'monetization';
      link1.href = 'https://ilp.interledger-test.dev/tech1';
      document.head.appendChild(link1);

      const link2 = document.createElement('link');
      link2.rel = 'monetization';
      link2.href = 'https://ilp.interledger-test.dev/tech2';
      document.head.appendChild(link2);

      const link3 = document.createElement('link');
      link3.rel = 'monetization';
      link3.href = 'https://ilp.interledger-test.dev/tech3';
      document.head.appendChild(link3);

      await new Promise(process.nextTick);

      const request1Id = requestIdMock.mock.results[1].value;
      const request2Id = requestIdMock.mock.results[2].value;
      const request3Id = requestIdMock.mock.results[3].value;

      expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(3);
      expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
      expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: request1Id,
          walletAddress: WALLET_ADDRESS[0],
        },
        {
          requestId: request2Id,
          walletAddress: WALLET_ADDRESS[1],
        },
        {
          requestId: request3Id,
          walletAddress: WALLET_ADDRESS[2],
        },
      ]);
    });

    test('should handle rapid attribute changes on monetization link', async () => {
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

      const link = document.querySelector(
        'link[rel="monetization"]',
      )! as HTMLLinkElement;
      const initialRequestId = requestIdMock.mock.results[1].value;

      // Rapid changes to link attributes
      link.setAttribute('disabled', '');
      link.removeAttribute('disabled');
      link.href = 'https://ilp.interledger-test.dev/new';
      link.setAttribute('rel', 'preload');
      link.setAttribute('rel', 'monetization');

      await new Promise(process.nextTick);

      expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: initialRequestId,
          intent: 'remove',
        },
      ]);
      expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(1);
    });

    test('should handle concurrent validation of multiple links with some failing', async () => {
      const { document, documentReadyState } = createTestEnv({});

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      const failingLink = document.createElement('link');
      failingLink.rel = 'monetization';
      failingLink.href = 'https://ilp.interledger-test.dev/tech2';
      const errorSpy = jest.spyOn(failingLink, 'dispatchEvent');
      document.head.appendChild(failingLink);

      msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
        new Error('Network error'),
      )
        .mockResolvedValueOnce(success(WALLET_ADDRESS[0]))
        .mockResolvedValueOnce(success(WALLET_ADDRESS[1]));

      linkManager.start();

      // add other links after the failing one
      [
        'https://ilp.interledger-test.dev/tech1',
        'https://ilp.interledger-test.dev/tech3',
      ].map((href) => {
        const link = document.createElement('link');
        link.rel = 'monetization';
        link.href = href;
        document.head.appendChild(link);
        return link;
      });

      await new Promise(process.nextTick);

      const request1Id = requestIdMock.mock.results[1].value;
      const request3Id = requestIdMock.mock.results[2].value;

      expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: request1Id,
          walletAddress: WALLET_ADDRESS[0],
        },
        {
          requestId: request3Id,
          walletAddress: WALLET_ADDRESS[1],
        },
      ]);

      const errorEvent = errorSpy.mock.calls[0][0] as Event;
      expect(errorEvent.type).toBe('error');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });

  describe('monetization in first level frame', () => {
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

    test('should handle only first link tag in first-level iframe', async () => {
      // also test disabling a link tag in iframe, changing URL of first link tag, and prepending another link tag
      const { document: doc } = createTestEnv({
        body: html`<iframe id="testFrame"></iframe>`,
      });
      const iframe = doc.getElementsByTagName('iframe')[0];
      const iframeDocument = iframe.contentDocument!;
      const iframeWindow = iframe.contentWindow!.window;

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      )
        .mockResolvedValueOnce(success(WALLET_ADDRESS[1]))
        .mockResolvedValueOnce(success(WALLET_ADDRESS[2]));

      const postMessageSpy = jest.spyOn(iframeWindow.parent, 'postMessage');
      const linkManager = createMonetizationLinkManager(iframeDocument);
      const iframeId = requestIdMock.mock.results[0].value;

      jest.spyOn(doc, 'readyState', 'get').mockReturnValue('interactive');
      jest
        .spyOn(iframeDocument, 'readyState', 'get')
        .mockReturnValue('interactive');

      linkManager.start();

      const link1 = iframeDocument.createElement('link');
      link1.rel = 'monetization';
      link1.href = 'https://ilp.interledger-test.dev/tech1';
      iframeDocument.head.appendChild(link1);

      await new Promise(process.nextTick);

      const firstRequestId = requestIdMock.mock.results[1].value;

      // test disable first link tag in iframe
      link1.setAttribute('disabled', '');
      await new Promise(process.nextTick);

      expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: firstRequestId,
          intent: 'disable',
        },
      ]);

      // test first link URL change
      link1.removeAttribute('disabled');
      link1.href = 'https://ilp.interledger-test.dev/tech2';

      await new Promise(process.nextTick);

      const secondRequestId = requestIdMock.mock.results[2].value;

      // prepend another link (should be ignored in iframe)
      const link2 = iframeDocument.createElement('link');
      link2.rel = 'monetization';
      link2.href = 'https://ilp.interledger-test.dev/tech3';
      iframeDocument.head.insertBefore(link2, link1);

      await new Promise(process.nextTick);

      // Verify only the first link is active
      expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(2);
      expect(postMessageSpy).toHaveBeenLastCalledWith(
        {
          id: iframeId,
          message: 'IS_MONETIZATION_ALLOWED_ON_START',
          payload: [
            {
              requestId: secondRequestId,
              walletAddress: WALLET_ADDRESS[1],
            },
          ],
        },
        '*',
      );
    });

    test('should handle dynamically added monetization link in first-lvl iframe, after page load', async () => {
      const { document: doc } = createTestEnv({
        body: html`<iframe id="testFrame"></iframe>`,
      });
      const iframe = doc.getElementsByTagName('iframe')[0];
      const iframeDocument = iframe.contentDocument!;
      const iframeWindow = iframe.contentWindow!.window;

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      ).mockResolvedValueOnce(success(WALLET_ADDRESS[1]));

      const postMessageSpy = jest.spyOn(iframeWindow.parent, 'postMessage');
      const linkManager = createMonetizationLinkManager(iframeDocument);
      const iframeId = requestIdMock.mock.results[0].value;
      jest
        .spyOn(iframeDocument, 'readyState', 'get')
        .mockReturnValue('interactive');

      linkManager.start();

      // append body
      const wrapper1 = iframeDocument.createElement('div');
      wrapper1.innerHTML =
        '<link rel="monetization" href="https://ilp.interledger-test.dev/tech1">';
      iframeDocument.body.appendChild(wrapper1);

      await new Promise(process.nextTick);

      // append head
      const wrapper2 = iframeDocument.createElement('div');
      wrapper2.innerHTML =
        '<link rel="monetization" href="https://ilp.interledger-test.dev/tech2">';
      iframeDocument.head.appendChild(wrapper2);

      await new Promise(process.nextTick);

      // only the head link should be processed in iframe
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          id: iframeId,
          message: 'IS_MONETIZATION_ALLOWED_ON_START',
          payload: [
            {
              requestId:
                requestIdMock.mock.results[requestIdMock.mock.calls.length - 1]
                  .value,
              walletAddress: WALLET_ADDRESS[0],
            },
          ],
        },
        '*',
      );
      expect(postMessageSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('link tag attributes changes', () => {
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

      link.removeAttribute('disabled');

      await new Promise(process.nextTick);

      expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
        {
          requestId: walletAddressInfoRequestId,
          walletAddress: WALLET_ADDRESS[0],
        },
      ]);
    });

    test('should handle monetization link rel attribute change', async () => {
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

      const requestId = requestIdMock.mock.results[1].value;
      const link = document.querySelector('link[rel="monetization"]')!;

      link.setAttribute('rel', 'preload');

      await new Promise(process.nextTick);

      expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId,
          intent: 'remove',
        },
      ]);

      link.setAttribute('rel', 'monetization');

      await new Promise(process.nextTick);

      const newRequestId = requestIdMock.mock.results[1].value;
      expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: newRequestId,
          walletAddress: WALLET_ADDRESS[0],
        },
      ]);
    });
  });

  describe('page document events', () => {
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

    test('should handle pagehide event', async () => {
      const { document, documentReadyState, window } = createTestEnv({
        head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
      });

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      );

      linkManager.start();

      await new Promise(process.nextTick);

      window.dispatchEvent(new window.Event('pagehide'));

      const walletAddressInfoRequestId = requestIdMock.mock.results[1].value;
      expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
        {
          requestId: walletAddressInfoRequestId,
          intent: 'remove',
        },
      ]);
    });

    test('should handle focus event', async () => {
      const { document, window, documentReadyState } = createTestEnv({
        head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech">`,
      });

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      );

      jest.spyOn(document, 'hasFocus').mockReturnValue(true);

      linkManager.start();

      await new Promise(process.nextTick);

      window.dispatchEvent(new window.Event('focus'));

      // once on start, once on focus event
      expect(msg.TAB_FOCUSED).toHaveBeenCalledTimes(2);
    });
  });

  describe('load event dispatching', () => {
    test('should dispatch load event exactly once per validated link', async () => {
      const { document, documentReadyState } = createTestEnv({
        head: html`
          <link rel="monetization" href="https://ilp.interledger-test.dev/tech1">
          <link rel="monetization" href="https://ilp.interledger-test.dev/tech2">
        `,
      });

      const links = document.querySelectorAll('link[rel="monetization"]');
      const dispatchEventSpies = [...links].map((link) =>
        jest.spyOn(link, 'dispatchEvent'),
      );

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      ).mockResolvedValueOnce(success(WALLET_ADDRESS[1]));

      linkManager.start();

      await new Promise(process.nextTick);

      // verify each link got exactly one load event
      for (const spy of dispatchEventSpies) {
        const loadEvents = spy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'load',
        );
        expect(loadEvents).toHaveLength(1);
      }
    });

    test('should dispatch load event once when link is modified, but link remains valid', async () => {
      const { document, documentReadyState } = createTestEnv({
        head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech1">`,
      });

      const link = document.querySelector(
        'link[rel="monetization"]',
      )! as HTMLLinkElement;
      const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      ).mockResolvedValueOnce(success(WALLET_ADDRESS[1]));

      linkManager.start();

      await new Promise(process.nextTick);

      expect(
        dispatchEventSpy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'load',
        ),
      ).toHaveLength(1);

      link.href = 'https://ilp.interledger-test.dev/tech2';

      await new Promise(process.nextTick);

      expect(
        dispatchEventSpy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'load',
        ),
      ).toHaveLength(2);
    });

    test('should handle load events correctly when replacing a link element', async () => {
      const { document, documentReadyState } = createTestEnv({
        head: html`<link rel="monetization" href="https://ilp.interledger-test.dev/tech1">`,
      });

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_ADDRESS[0]),
      ).mockResolvedValueOnce(success(WALLET_ADDRESS[1]));

      linkManager.start();

      const originalLink = document.querySelector('link[rel="monetization"]')!;
      const originalDispatchSpy = jest.spyOn(originalLink, 'dispatchEvent');

      await new Promise(process.nextTick);

      expect(
        originalDispatchSpy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'load',
        ),
      ).toHaveLength(1);

      // replace the link with a new one
      const newLink = document.createElement('link');
      newLink.rel = 'monetization';
      newLink.href = 'https://ilp.interledger-test.dev/tech2';
      const newDispatchSpy = jest.spyOn(newLink, 'dispatchEvent');

      originalLink.replaceWith(newLink);

      await new Promise(process.nextTick);

      expect(
        originalDispatchSpy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'load',
        ),
      ).toHaveLength(1);

      expect(
        newDispatchSpy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'load',
        ),
      ).toHaveLength(1);
    });

    test('should not dispatch load event for invalid links', async () => {
      const { document, documentReadyState } = createTestEnv({
        head: html`
          <link rel="monetization" href="invalid://url">
          <link rel="monetization" href="https://ilp.interledger-test.dev/tech1">
        `,
      });

      const [invalidLink, validLink] = document.querySelectorAll(
        'link[rel="monetization"]',
      );
      const invalidLinkSpy = jest.spyOn(invalidLink, 'dispatchEvent');
      const validLinkSpy = jest.spyOn(validLink, 'dispatchEvent');

      const linkManager = createMonetizationLinkManager(document);
      documentReadyState.mockReturnValue('interactive');

      msg.GET_WALLET_ADDRESS_INFO.mockRejectedValue(
        failure('Invalid URL'),
      ).mockResolvedValue(success(WALLET_ADDRESS[0]));

      linkManager.start();

      await new Promise(process.nextTick);

      expect(
        invalidLinkSpy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'load',
        ),
      ).toHaveLength(0);
      expect(
        invalidLinkSpy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'error',
        ),
      ).toHaveLength(1);

      // valid link should have received exactly one load event
      expect(
        validLinkSpy.mock.calls.filter(
          (call) => (call[0] as Event).type === 'load',
        ),
      ).toHaveLength(1);
    });
  });
});
