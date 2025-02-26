import { promisify } from 'node:util';
import { JSDOM } from 'jsdom';
import { MonetizationLinkManager } from '@/content/services/monetizationLinkManager';
import type {
  ContentToBackgroundMessage,
  MessageManager,
  Response,
} from '@/shared/messages';
import type { Logger } from '@/shared/logger';
import type { WalletAddress } from '@interledger/open-payments';
import { success, failure } from '@/shared/helpers';

// for syntax highlighting
const html = String.raw;

const WALLET_INFO: WalletAddress[] = [
  {
    id: 'https://wallet.example.com/alice',
    authServer: 'https://auth.example.com',
    resourceServer: 'https://wallet.example.com',
    publicName: 'Alice USD Wallet',
    assetCode: 'USD',
    assetScale: 2,
  },
  {
    id: 'https://wallet.example.com/bob',
    authServer: 'https://auth2.example.com',
    resourceServer: 'https://wallet2.example.com',
    publicName: 'Bob EUR Wallet',
    assetCode: 'EUR',
    assetScale: 2,
  },
  {
    id: 'https://wallet.example.com/carol',
    authServer: 'https://auth3.example.com',
    resourceServer: 'https://wallet3.example.com',
    publicName: 'Carol MXN Wallet',
    assetCode: 'MXN',
    assetScale: 2,
  },
];
const WALLET_ADDRESS = WALLET_INFO.map((e) => e.id);

const messageManager = {
  send: () => {},
} as unknown as MessageManager<ContentToBackgroundMessage>;
const loggerMock = {
  error: jest.fn(),
} as unknown as Logger;
const requestIdMock = jest.fn(() => `request-${Math.random()}`);
const nextTick = promisify(process.nextTick);

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
  readyState = 'interactive',
}: {
  head?: string;
  body?: string;
  readyState?: DocumentReadyState;
} = {}) {
  const htm = html`<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
  const dom = new JSDOM(htm, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    resources: 'usable',
  });

  const window = dom.window;
  const document = window.document;
  const documentReadyState = jest.spyOn(document, 'readyState', 'get');

  documentReadyState.mockReturnValue(readyState);

  return {
    dom,
    window,
    document,
    documentReadyState,
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
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const link = document.querySelector('link[rel="monetization"]')!;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();

    // wait for check link validation to complete
    await nextTick();

    // check if dispatchEvent was called with a 'load' event
    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEventSpy.mock.lastCall![0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);

    // @ts-ignore - accessing private property for testing
    expect(linkManager.isTopFrame).toBe(true);
    // @ts-ignore
    expect(linkManager.isFirstLevelFrame).toBe(true);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(1);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: WALLET_ADDRESS[0],
    });
    const requestId = requestIdMock.mock.results.at(-1)!.value;

    // event was dispatched on correct link element
    expect(dispatchEventSpy.mock.instances[0]).toBe(link);

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);
  });

  test('should stop handle monetization on link element removal', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();

    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    const link = document.querySelector('link[rel="monetization"]')!;
    link.remove();

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId,
        intent: 'remove',
      },
    ]);
  });

  test('should handle parent of link tag getting removed, then an element containing link tag added back dynamically', async () => {
    const { document } = createTestEnv({
      head: html`<div id="container"><link rel="monetization" href="${WALLET_ADDRESS[0]}"></div>`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();

    await nextTick();

    const initialRequestId = requestIdMock.mock.results[1].value;
    const container = document.getElementById('container')!;
    container.remove();

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: initialRequestId,
        intent: 'remove',
      },
    ]);

    // add a new container with the same link
    const newContainer = document.createElement('div');
    newContainer.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[0]}">`;
    document.head.appendChild(newContainer);

    await nextTick();

    const newRequestId = requestIdMock.mock.results[2].value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: newRequestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);
  });

  test('should handle two monetization link tags', async () => {
    const { document } = createTestEnv({
      head: html`
          <link rel="monetization" href="${WALLET_ADDRESS[0]}">
          <link rel="monetization" href="${WALLET_ADDRESS[1]}">
        `,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();

    await nextTick();

    const walletAddress1RequestId = requestIdMock.mock.results[1].value;
    const walletAddress2RequestId = requestIdMock.mock.results[2].value;
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(1, {
      walletAddressUrl: WALLET_ADDRESS[0],
    });
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddress1RequestId,
        walletAddress: WALLET_INFO[0],
      },
      {
        requestId: walletAddress2RequestId,
        walletAddress: WALLET_INFO[1],
      },
    ]);
  });

  test('should handle invalid wallet address URL', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="invalid-url">`,
    });
    const link = document.querySelector('link[rel="monetization"]')!;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
      failure('Could not retrieve wallet address information'),
    );

    linkManager.start();

    await nextTick();

    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('error'));
    expect(loggerMock.error).toHaveBeenCalledTimes(1);

    expect(msg.START_MONETIZATION).not.toHaveBeenCalledWith(expect.any(Array));
  });

  test('should handle dynamically added monetization link', async () => {
    const { document } = createTestEnv({});

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    linkManager.start();

    for (const key of Object.keys(msg)) {
      expect(msg[key as keyof typeof msg]).not.toHaveBeenCalled();
    }

    // add monetization link after initialization
    const link = document.createElement('link');
    link.rel = 'monetization';
    link.href = `https://wallet.example.com/${WALLET_ADDRESS[0]}`;
    document.head.appendChild(link);

    await nextTick();

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: `https://wallet.example.com/${WALLET_ADDRESS[0]}`,
    });

    const requestId = requestIdMock.mock.results[1].value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);
  });

  test('should handle two link tags added simultaneously', async () => {
    const { document } = createTestEnv({});

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();

    for (const key of Object.keys(msg)) {
      expect(msg[key as keyof typeof msg]).not.toHaveBeenCalled();
    }

    // create and add two monetization links simultaneously
    const link1 = document.createElement('link');
    link1.rel = 'monetization';
    link1.href = `https://wallet.example.com/${WALLET_ADDRESS[0]}`;

    const link2 = document.createElement('link');
    link2.rel = 'monetization';
    link2.href = `https://wallet2.example.com/${WALLET_ADDRESS[1]}`;

    // append both links in quick succession
    document.head.appendChild(link1);
    document.head.appendChild(link2);

    // simulate multiple mutation callbacks for the second link
    // by triggering an additional attribute change
    link2.setAttribute('crossorigin', 'anonymous');

    await nextTick();

    const walletAddress1RequestId = requestIdMock.mock.results[1].value;
    const walletAddress2RequestId = requestIdMock.mock.results[2].value;

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(2);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(1, {
      walletAddressUrl: `https://wallet.example.com/${WALLET_ADDRESS[0]}`,
    });
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: `https://wallet2.example.com/${WALLET_ADDRESS[1]}`,
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddress1RequestId,
        walletAddress: WALLET_INFO[0],
      },
      {
        requestId: walletAddress2RequestId,
        walletAddress: WALLET_INFO[1],
      },
    ]);

    // verify that both links are being observed for attribute changes
    link1.href = 'https://ilp.interledger-test.dev/tech1-updated';
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddress1RequestId,
        intent: 'remove',
      },
    ]);
  });

  test('should handle element with link tag append and removal', async () => {
    const { document } = createTestEnv({});

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[0]}">`;
    document.head.appendChild(wrapper);

    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);

    wrapper.remove();

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId,
        intent: 'remove',
      },
    ]);
  });

  test('more link tags added right after, leading to another mutation', async () => {
    const { document } = createTestEnv({});

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]))
      .mockResolvedValueOnce(success(WALLET_INFO[1]))
      .mockResolvedValueOnce(success(WALLET_INFO[2]));

    linkManager.start();

    for (const key of Object.keys(msg)) {
      expect(msg[key as keyof typeof msg]).not.toHaveBeenCalled();
    }

    // first mutation
    const link1 = document.createElement('link');
    link1.rel = 'monetization';
    link1.href = `https://wallet.example.com/${WALLET_ADDRESS[0]}`;
    document.head.appendChild(link1);

    await nextTick();

    const walletAddress1RequestId = requestIdMock.mock.results[1].value;
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(1, [
      {
        requestId: walletAddress1RequestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);

    // second mutation
    const link2 = document.createElement('link');
    link2.rel = 'monetization';
    link2.href = `https://wallet2.example.com/${WALLET_ADDRESS[1]}`;
    document.head.appendChild(link2);

    const link3 = document.createElement('link');
    link3.rel = 'monetization';
    link3.href = `https://wallet3.example.com/${WALLET_ADDRESS[2]}`;
    document.head.appendChild(link3);

    await nextTick();

    const walletAddress2RequestId = requestIdMock.mock.results[2].value;
    const walletAddress3RequestId = requestIdMock.mock.results[3].value;

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(3);
    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(2);
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      {
        requestId: walletAddress2RequestId,
        walletAddress: WALLET_INFO[1],
      },
      {
        requestId: walletAddress3RequestId,
        walletAddress: WALLET_INFO[2],
      },
    ]);
  });

  test('should handle rapid attribute changes on monetization link', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();
    await nextTick();

    const link = document.querySelector(
      'link[rel="monetization"]',
    )! as HTMLLinkElement;
    const initialRequestId = requestIdMock.mock.results[1].value;

    link.setAttribute('disabled', '');
    link.removeAttribute('disabled');
    link.href = 'https://ilp.interledger-test.dev/new';
    link.setAttribute('rel', 'preload');
    link.setAttribute('rel', 'monetization');

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: initialRequestId,
        intent: 'remove',
      },
    ]);
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(1);
  });

  test('should handle concurrent validation of multiple links with some failing', async () => {
    const { document } = createTestEnv({});

    const linkManager = createMonetizationLinkManager(document);

    const failingLink = document.createElement('link');
    failingLink.rel = 'monetization';
    failingLink.href = 'https://ilp.interledger-test.dev/tech2';
    const errorSpy = jest.spyOn(failingLink, 'dispatchEvent');
    document.head.appendChild(failingLink);

    msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
      new Error('Network error'),
    )
      .mockResolvedValueOnce(success(WALLET_INFO[0]))
      .mockResolvedValueOnce(success(WALLET_INFO[1]));

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

    await nextTick();

    const walletAddress1RequestId = requestIdMock.mock.results[1].value;
    const walletAddress3RequestId = requestIdMock.mock.results[2].value;

    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddress1RequestId,
        walletAddress: WALLET_INFO[0],
      },
      {
        requestId: walletAddress3RequestId,
        walletAddress: WALLET_INFO[1],
      },
    ]);

    const errorEvent = errorSpy.mock.lastCall![0] as Event;
    expect(errorEvent.type).toBe('error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
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
      html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    );
    const iframeWindow = iframe.contentWindow!.window;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    const link = iframeDocument.querySelector('link[rel="monetization"]')!;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const postMessageSpy = jest.spyOn(iframeWindow.parent, 'postMessage');
    const linkManager = createMonetizationLinkManager(iframeDocument);
    const iframeId = requestIdMock.mock.results[0].value;

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
      walletAddressUrl: WALLET_ADDRESS[0],
    });

    await nextTick();

    const iframeWARequestId = requestIdMock.mock.results.at(-1)!.value;

    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEventSpy.mock.lastCall![0] as Event;
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
            requestId: iframeWARequestId,
            walletAddress: WALLET_INFO[0],
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
            requestId: iframeWARequestId,
            walletAddress: WALLET_INFO[0],
          },
        ],
      },
    });

    iframeWindow.dispatchEvent(messageEvent);

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: iframeWARequestId,
        walletAddress: WALLET_INFO[0],
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

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]))
      .mockResolvedValueOnce(success(WALLET_INFO[1]))
      .mockResolvedValueOnce(success(WALLET_INFO[2]));

    const postMessageSpy = jest.spyOn(iframeWindow.parent, 'postMessage');
    const linkManager = createMonetizationLinkManager(iframeDocument);
    const iframeId = requestIdMock.mock.results[0].value;

    linkManager.start();

    const link1 = iframeDocument.createElement('link');
    link1.rel = 'monetization';
    link1.href = 'https://ilp.interledger-test.dev/tech1';
    iframeDocument.head.appendChild(link1);

    await nextTick();

    const firstRequestId = requestIdMock.mock.results[1].value;

    // test disable first link tag in iframe
    link1.setAttribute('disabled', '');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: firstRequestId,
        intent: 'disable',
      },
    ]);

    // test first link URL change
    link1.removeAttribute('disabled');
    link1.href = 'https://ilp.interledger-test.dev/tech2';

    await nextTick();

    const secondRequestId = requestIdMock.mock.results[2].value;

    // prepend another link (should be ignored in iframe)
    const link2 = iframeDocument.createElement('link');
    link2.rel = 'monetization';
    link2.href = 'https://ilp.interledger-test.dev/tech3';
    iframeDocument.head.insertBefore(link2, link1);

    await nextTick();

    // Verify only the first link is active
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(2);
    expect(postMessageSpy).toHaveBeenLastCalledWith(
      {
        id: iframeId,
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          {
            requestId: secondRequestId,
            walletAddress: WALLET_INFO[1],
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
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    const postMessageSpy = jest.spyOn(iframeWindow.parent, 'postMessage');
    const linkManager = createMonetizationLinkManager(iframeDocument);
    const iframeId = requestIdMock.mock.results[0].value;

    linkManager.start();

    // append body
    const wrapper1 = iframeDocument.createElement('div');
    wrapper1.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[0]}">`;
    iframeDocument.body.appendChild(wrapper1);

    await nextTick();

    // append head
    const wrapper2 = iframeDocument.createElement('div');
    wrapper2.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[1]}">`;
    iframeDocument.head.appendChild(wrapper2);

    await nextTick();

    // only the head link should be processed in iframe
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        id: iframeId,
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          {
            requestId: requestIdMock.mock.results.at(-1)!.value,
            walletAddress: WALLET_INFO[0],
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
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();

    await nextTick();

    const walletAddressRequestId = requestIdMock.mock.results[1].value;
    const link = document.querySelector(
      'link[rel="monetization"]',
    )! as HTMLLinkElement;
    link.href = 'https://ilp.interledger-test.dev/new';

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: walletAddressRequestId,
        intent: 'remove',
      },
    ]);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: 'https://ilp.interledger-test.dev/new',
    });

    await nextTick();

    const newWalletAddressRequestId = requestIdMock.mock.results.at(-1)!.value;
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      {
        requestId: newWalletAddressRequestId,
        walletAddress: WALLET_INFO[1],
      },
    ]);
  });

  test('should handle monetization link disabled attribute change', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();

    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    const link = document.querySelector('link[rel="monetization"]')!;
    link.setAttribute('disabled', '');

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'disable' },
    ]);

    link.removeAttribute('disabled');

    await nextTick();

    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      {
        requestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);
  });

  test('should handle monetization link rel attribute change', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();

    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    const link = document.querySelector('link[rel="monetization"]')!;

    link.setAttribute('rel', 'preload');

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' },
    ]);

    link.setAttribute('rel', 'monetization');

    await nextTick();

    const newRequestId = requestIdMock.mock.results[1].value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: newRequestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);
  });
});

describe('page document events', () => {
  test('should handle document visibility change event', async () => {
    const { document, window } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();

    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    });
    document.dispatchEvent(new window.Event('visibilitychange'));

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([{ requestId }]);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    document.dispatchEvent(new window.Event('visibilitychange'));

    expect(msg.RESUME_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);
  });

  test('should handle pagehide event', async () => {
    const { document, window } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();

    await nextTick();

    window.dispatchEvent(new window.Event('pagehide'));

    const requestId = requestIdMock.mock.results[1].value;
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' },
    ]);
  });

  test('should handle focus event', async () => {
    const { document, window } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    jest.spyOn(document, 'hasFocus').mockReturnValue(true);

    linkManager.start();

    await nextTick();

    window.dispatchEvent(new window.Event('focus'));

    // once on start, once on focus event
    expect(msg.TAB_FOCUSED).toHaveBeenCalledTimes(2);
  });
});

describe('load event dispatching', () => {
  test('should dispatch load event exactly once per validated link', async () => {
    const { document } = createTestEnv({
      head: html`
          <link rel="monetization" href="${WALLET_ADDRESS[0]}">
          <link rel="monetization" href="${WALLET_ADDRESS[1]}">
        `,
    });

    const links = document.querySelectorAll('link[rel="monetization"]');
    const dispatchEventSpies = [...links].map((link) =>
      jest.spyOn(link, 'dispatchEvent'),
    );

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();

    await nextTick();

    // verify each link got exactly one load event
    for (const spy of dispatchEventSpies) {
      const loadEvents = spy.mock.calls.filter(
        (call) => (call[0] as Event).type === 'load',
      );
      expect(loadEvents).toHaveLength(1);
    }
  });

  test('should dispatch load event once when link is modified, but link remains valid', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const link = document.querySelector(
      'link[rel="monetization"]',
    )! as HTMLLinkElement;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();

    await nextTick();

    expect(
      dispatchEventSpy.mock.calls.filter(
        (call) => (call[0] as Event).type === 'load',
      ),
    ).toHaveLength(1);

    link.href = 'https://ilp.interledger-test.dev/tech2';

    await nextTick();

    expect(
      dispatchEventSpy.mock.calls.filter(
        (call) => (call[0] as Event).type === 'load',
      ),
    ).toHaveLength(2);
  });

  test('should handle load events correctly when replacing a link element', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();

    const originalLink = document.querySelector('link[rel="monetization"]')!;
    const originalDispatchSpy = jest.spyOn(originalLink, 'dispatchEvent');

    await nextTick();

    expect(
      originalDispatchSpy.mock.calls.filter(
        (call) => (call[0] as Event).type === 'load',
      ),
    ).toHaveLength(1);

    // replace the link with a new one
    const newLink = document.createElement('link');
    newLink.rel = 'monetization';
    newLink.href = WALLET_ADDRESS[1];
    const newDispatchSpy = jest.spyOn(newLink, 'dispatchEvent');

    originalLink.replaceWith(newLink);

    await nextTick();

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
    const { document } = createTestEnv({
      head: html`
          <link rel="monetization" href="invalid://url">
          <link rel="monetization" href="${WALLET_ADDRESS[0]}">
        `,
    });

    const [invalidLink, validLink] = document.querySelectorAll(
      'link[rel="monetization"]',
    );
    const invalidLinkSpy = jest.spyOn(invalidLink, 'dispatchEvent');
    const validLinkSpy = jest.spyOn(validLink, 'dispatchEvent');

    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockRejectedValue(
      failure('Invalid URL'),
    ).mockResolvedValue(success(WALLET_INFO[0]));

    linkManager.start();

    await nextTick();

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
