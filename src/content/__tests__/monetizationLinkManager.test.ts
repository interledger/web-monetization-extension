import { promisify } from 'node:util';
import { JSDOM } from 'jsdom';
import { MonetizationLinkManager } from '@/content/services/monetizationLinkManager';
import { success, failure } from '@/shared/helpers';
import type {
  ContentToBackgroundMessage as Msg,
  MessageManager,
  Response,
} from '@/shared/messages';
import type { Logger } from '@/shared/logger';
import type { WalletAddress } from '@interledger/open-payments';

const nextTick = promisify(process.nextTick);
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
} as unknown as MessageManager<Msg>;
const loggerMock = {
  error: jest.fn(),
} as unknown as Logger;

type MessageMocks = {
  [k in keyof Msg]: jest.Mock<
    Promise<Response<Msg[k]['output']>>,
    [Msg[k]['input']]
  >;
};
const msg: MessageMocks = {
  GET_WALLET_ADDRESS_INFO: jest.fn(),
  RESUME_MONETIZATION: jest.fn(),
  START_MONETIZATION: jest.fn(),
  STOP_MONETIZATION: jest.fn(),
  TAB_FOCUSED: jest.fn(),
};
const messageMock = jest.spyOn(messageManager, 'send');
// @ts-expect-error let it go
messageMock.mockImplementation((action, payload) => msg[action](payload));

// @ts-expect-error jest doesn't know of this
Symbol.dispose ??= Symbol('Symbol.dispose');

function createMonetizationLinkManager(document: Document) {
  const linkManager = new MonetizationLinkManager({
    global: document.defaultView!.globalThis,
    document: document,
    message: messageManager,
    logger: loggerMock,
  });

  return {
    start: () => linkManager.start(),
    get isTopFrame() {
      // @ts-expect-error accessing private property for testing
      return linkManager.isTopFrame;
    },
    get isFirstLevelFrame() {
      // @ts-expect-error accessing private property for testing
      return linkManager.isFirstLevelFrame;
    },
    [Symbol.dispose]: () => linkManager.end(),
  };
}

const createCounter = (prefix = 'uuid-', n = 0) => {
  // biome-ignore lint/style/noParameterAssign: it's cleaner and simpler
  return () => `${prefix}${n++}`;
};

function createTestEnv({
  head = '',
  body = '',
  readyState = 'interactive',
}: {
  head?: string;
  body?: string;
  readyState?: DocumentReadyState | null;
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
  const documentVisibilityState = jest.spyOn(
    document,
    'visibilityState',
    'get',
  );

  if (readyState) {
    documentReadyState.mockReturnValue(readyState);
  }

  const crypto = document.defaultView!.globalThis.crypto;
  Object.defineProperty(crypto, 'randomUUID', {
    value: jest.fn(createCounter()),
  });

  return {
    dom,
    window,
    document,
    documentReadyState,
    documentVisibilityState,
  };
}

function createTestEnvWithIframe({
  head = '',
  body = '',
  attrs = {},
  readyState = 'interactive',
}: {
  head?: string;
  body?: string;
  attrs?: Record<string, string>;
  readyState?: DocumentReadyState | null;
} = {}) {
  const { id = 'test', allow = 'monetization' } = attrs;
  const host = createTestEnv({
    body: html`<iframe id="${id}" allow="${allow}"></iframe>`,
    readyState,
  });
  const iframe = host.document.getElementsByTagName('iframe')[0];
  const iframeDocument = iframe.contentDocument!;
  const iframeWindow = iframe.contentWindow!.window;

  const crypto = iframeDocument.defaultView!.globalThis.crypto;
  Object.defineProperty(crypto, 'randomUUID', {
    value: jest.fn(createCounter('uuid-iframe-')),
  });

  if (head) iframeDocument.head.insertAdjacentHTML('afterbegin', head);
  if (body) iframeDocument.body.insertAdjacentHTML('afterbegin', body);

  return {
    document: iframeDocument,
    window: iframeWindow,
    iframe,
    postMessage: jest.spyOn(iframeWindow.parent, 'postMessage'),
    dispatchMessage: (data: unknown) => {
      const messageEvent = new iframeWindow.MessageEvent('message', { data });
      iframeWindow.dispatchEvent(messageEvent);
    },
    host,
  };
}

function createLink(document: Document, href: string) {
  const link = document.createElement('link');
  link.setAttribute('rel', 'monetization');
  link.setAttribute('href', href);
  return link;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of Object.values(msg)) {
    mock.mockReset();
  }
});

describe('monetization in main frame', () => {
  test('detects monetization link tags', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    const link = document.querySelector('link')!;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    // wait for check link validation to complete
    await nextTick();

    // check if dispatchEvent was called with a 'load' event
    expect(dispatchEventSpy).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEventSpy.mock.lastCall![0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);

    expect(linkManager.isTopFrame).toBe(true);
    expect(linkManager.isFirstLevelFrame).toBe(true);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(1);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: WALLET_ADDRESS[0],
    });

    // event was dispatched on correct link element
    expect(dispatchEventSpy.mock.instances[0]).toBe(link);

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('stops monetization on link element removal', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    document.querySelector('link')!.remove();
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', intent: 'remove' },
    ]);
  });

  test('stops monetization when parent of link tag is removed', async () => {
    const { document } = createTestEnv({
      head: html`<div id="container">
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">
      </div>`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    document.getElementById('container')!.remove();
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', intent: 'remove' },
    ]);
  });

  test('starts monetization when an element containing link tag is added', async () => {
    const { document } = createTestEnv();
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const newContainer = document.createElement('div');
    newContainer.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[0]}">`;
    document.head.appendChild(newContainer);
    await nextTick();

    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('accepts two monetization link tags at start', async () => {
    const { document } = createTestEnv({
      head: html`
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">
        <link rel="monetization" href="${WALLET_ADDRESS[1]}">
      `,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();
    await nextTick();

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(1, {
      walletAddressUrl: WALLET_ADDRESS[0],
    });
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', walletAddress: WALLET_INFO[0] },
      { requestId: 'uuid-2', walletAddress: WALLET_INFO[1] },
    ]);
  });

  test('rejects invalid wallet address URL', async () => {
    const { document } = createTestEnv({
      head: html`
        <link rel="monetization" href="invalid-url">
        <link rel="monetization" href="https://example.com">
      `,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
      failure('Could not retrieve wallet address information'),
    );
    msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
      failure('This wallet address does not exist.'),
    );
    const dispatchEventSpy = [...document.querySelectorAll('link')].map(
      (link) => jest.spyOn(link, 'dispatchEvent'),
    );

    linkManager.start();
    await nextTick();

    expect(dispatchEventSpy[0]).toHaveBeenCalledWith(new Event('error'));
    expect(dispatchEventSpy[1]).toHaveBeenCalledWith(new Event('error'));
    expect(loggerMock.error).toHaveBeenCalledTimes(2);

    expect(msg.START_MONETIZATION).not.toHaveBeenCalledWith(expect.any(Array));
  });

  test('accepts dynamically added monetization link', async () => {
    const { document } = createTestEnv({});
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();
    expect(messageMock).not.toHaveBeenCalled();

    const link = createLink(document, WALLET_ADDRESS[0]);
    document.head.appendChild(link);
    await nextTick();

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: WALLET_ADDRESS[0],
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('handles dynamic link tag append and remove', async () => {
    const { document } = createTestEnv({});
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const wrapper = document.createElement('div');
    wrapper.append(createLink(document, WALLET_ADDRESS[0]));
    document.head.appendChild(wrapper);
    await nextTick();

    const requestId = 'uuid-1';
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId, walletAddress: WALLET_INFO[0] },
    ]);

    wrapper.remove();
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' },
    ]);
  });

  test('accepts two link tags added simultaneously', async () => {
    const { document } = createTestEnv({});
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
      success(WALLET_INFO[0]),
    ).mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();
    await nextTick();

    expect(messageMock).not.toHaveBeenCalled();

    const link1 = createLink(document, WALLET_ADDRESS[0]);
    const link2 = createLink(document, WALLET_ADDRESS[1]);
    document.head.appendChild(link1);
    document.head.appendChild(link2);
    await nextTick();

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(2);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(1, {
      walletAddressUrl: WALLET_ADDRESS[0],
    });
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', walletAddress: WALLET_INFO[0] },
      { requestId: 'uuid-2', walletAddress: WALLET_INFO[1] },
    ]);

    // verify that both links are being observed for attribute changes
    link1.href = 'https://ilp.interledger-test.dev/tech1-updated';
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', intent: 'remove' },
    ]);
  });

  test('handles link tags added right after (quick MutationObserver callback)', async () => {
    const { document } = createTestEnv({});
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[2]));

    linkManager.start();
    await nextTick();

    expect(messageMock).not.toHaveBeenCalled();

    // first mutation
    const link1 = createLink(document, WALLET_ADDRESS[0]);
    document.head.appendChild(link1);
    await nextTick();

    // second mutation
    const link2 = createLink(document, WALLET_ADDRESS[1]);
    const link3 = createLink(document, WALLET_ADDRESS[2]);
    document.head.appendChild(link2);
    document.head.appendChild(link3);
    await nextTick();

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(3);
    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(2);
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(1, [
      { requestId: 'uuid-1', walletAddress: WALLET_INFO[0] },
    ]);
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      { requestId: 'uuid-2', walletAddress: WALLET_INFO[1] },
      { requestId: 'uuid-3', walletAddress: WALLET_INFO[2] },
    ]);
  });

  test.failing('handles rapid attribute changes on link', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValue(success(WALLET_INFO[1]));

    linkManager.start();
    await nextTick();

    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', walletAddress: WALLET_INFO[0] },
    ]);

    const link = document.querySelector('link')!;
    // make these changes without awaiting between them to simulate
    // multiple changes happening within a single event loop
    link.setAttribute('disabled', '');
    link.removeAttribute('disabled');
    link.href = WALLET_ADDRESS[1];
    link.setAttribute('rel', 'preload');
    link.setAttribute('rel', 'monetization');
    await nextTick();

    // // check that monetization was stopped due to attribute changes
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', intent: 'remove' },
    ]);
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(1);

    // the final state has rel="monetization" but the href changed, so it should
    // attempt to validate the new wallet address
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(2);

    // when the link stops using rel="monetization" and then starts again,
    // it should be treated as a new monetization link and validate the URL again
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenLastCalledWith({
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    // after validation of the new URL, it should start monetization with the new address
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-2', walletAddress: WALLET_INFO[1] },
    ]);
  });

  test('handles concurrent validation of multiple links with some failing', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);
    const failingLink = document.querySelector('link')!;

    const errorSpy = jest.spyOn(failingLink, 'dispatchEvent');
    msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
      new Error('Network error'),
    );
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();
    await nextTick();

    // add other links after the failing one
    document.head.appendChild(createLink(document, WALLET_ADDRESS[1]));
    document.head.appendChild(createLink(document, WALLET_ADDRESS[2]));
    await nextTick();

    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', walletAddress: WALLET_INFO[0] },
      { requestId: 'uuid-2', walletAddress: WALLET_INFO[1] },
    ]);

    const errorEvent = errorSpy.mock.lastCall![0] as Event;
    expect(errorEvent.type).toBe('error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
  });
});

describe('monetization in first level iframe', () => {
  test('detects monetization links in head', async () => {
    const { document, postMessage, dispatchMessage } = createTestEnvWithIframe({
      head: html`
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">
        <link rel="monetization" href="${WALLET_ADDRESS[1]}">
      `,
    });
    using linkManager = createMonetizationLinkManager(document);
    const link = document.querySelector('link')!;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    const dispatchEvent = jest.spyOn(link, 'dispatchEvent');

    const iframeId = 'uuid-iframe-0';
    const iframeWARequestId = 'uuid-iframe-1';

    linkManager.start();
    await nextTick();

    expect(postMessage).toHaveBeenCalledWith(
      {
        message: 'INITIALIZE_IFRAME',
        id: iframeId,
        payload: undefined,
      },
      '*',
    );

    expect(linkManager.isTopFrame).toBe(false);
    expect(linkManager.isFirstLevelFrame).toBe(true);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(1);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: WALLET_ADDRESS[0],
    });

    await nextTick();

    expect(dispatchEvent).toHaveBeenCalledWith(new Event('load'));
    const dispatchedLoadEvent = dispatchEvent.mock.lastCall![0] as Event;
    expect(dispatchedLoadEvent.type).toBe('load');
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.instances[0]).toBe(link);

    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      {
        id: iframeId,
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          { requestId: iframeWARequestId, walletAddress: WALLET_INFO[0] },
        ],
      },
      '*',
    );
    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [
        { requestId: iframeWARequestId, walletAddress: WALLET_INFO[0] },
      ],
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: iframeWARequestId, walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('ignores monetization links in body', async () => {
    const { document, postMessage } = createTestEnvWithIframe({
      body: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'INITIALIZE_IFRAME' }),
      '*',
    );

    expect(msg.GET_WALLET_ADDRESS_INFO).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'IS_MONETIZATION_ALLOWED_ON_START' }),
    );
    expect(msg.START_MONETIZATION).not.toHaveBeenCalled();
  });

  test('ignores first disabled link tag on start', async () => {
    const { document, postMessage } = createTestEnvWithIframe({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}" disabled>`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'INITIALIZE_IFRAME' }),
      '*',
    );

    // Disabled link should not be processed for monetization
    expect(msg.GET_WALLET_ADDRESS_INFO).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'IS_MONETIZATION_ALLOWED_ON_START' }),
      '*',
    );
    expect(msg.START_MONETIZATION).not.toHaveBeenCalled();
  });

  test.failing('accepts only first link tag in iframe context', async () => {
    const { document, postMessage, dispatchMessage } = createTestEnvWithIframe({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);
    const link1 = document.querySelector('link')!;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[2]));
    const iframeId = 'uuid-iframe-0';
    const requestId1 = 'uuid-iframe-1';
    const requestId2 = 'uuid-iframe-2';
    const requestId3 = 'uuid-iframe-3';

    linkManager.start();
    await nextTick();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [{ requestId: requestId1, walletAddress: WALLET_INFO[0] }],
      }),
      '*',
    );

    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [{ requestId: requestId1, walletAddress: WALLET_INFO[0] }],
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: requestId1, walletAddress: WALLET_INFO[0] },
    ]);

    // first link is disabled
    link1.setAttribute('disabled', '');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: requestId1, intent: 'disable' },
    ]);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    link1.removeAttribute('disabled');
    link1.href = WALLET_ADDRESS[1];
    await nextTick();

    // verify link with new URL is validated and message sent to parent
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(3, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [{ requestId: requestId2, walletAddress: WALLET_INFO[1] }],
      }),
      '*',
    );

    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [{ requestId: requestId2, walletAddress: WALLET_INFO[1] }],
    });

    // prepend a new link before the original one
    const link2 = createLink(document, WALLET_ADDRESS[2]);
    document.head.insertBefore(link2, link1);
    await nextTick();

    // verify the prepended link (now the first one) is validated
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(3, {
      walletAddressUrl: WALLET_ADDRESS[2],
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [{ requestId: requestId3, walletAddress: WALLET_INFO[2] }],
      }),
      '*',
    );

    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [{ requestId: requestId3, walletAddress: WALLET_INFO[2] }],
    });

    // verify monetization started for the new first link
    expect(msg.START_MONETIZATION).toHaveBeenLastCalledWith([
      { requestId: requestId3, walletAddress: WALLET_INFO[2] },
    ]);

    // verify monetization was stopped for the previous link
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(2);
  });

  test.failing('accepts dynamically added monetization link', async () => {
    const { document, postMessage, dispatchMessage } =
      createTestEnvWithIframe();
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    const iframeId = 'uuid-iframe-0';

    linkManager.start();
    await nextTick();

    expect(postMessage).toHaveBeenCalledWith(
      {
        message: 'INITIALIZE_IFRAME',
        id: iframeId,
        payload: undefined,
      },
      '*',
    );

    // append body - should be ignored in iframe
    const wrapper1 = document.createElement('div');
    wrapper1.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[0]}">`;
    document.body.appendChild(wrapper1);
    await nextTick();

    expect(msg.GET_WALLET_ADDRESS_INFO).not.toHaveBeenCalled();

    // append head - should be processed in iframe
    const wrapper2 = document.createElement('div');
    wrapper2.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[1]}">`;
    document.head.appendChild(wrapper2);
    await nextTick();

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(1);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(postMessage).toHaveBeenCalledWith(
      {
        id: iframeId,
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          { requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[1] },
        ],
      },
      '*',
    );

    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [{ requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[1] }],
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[1] },
    ]);
  });

  test('stops monetization if first & only first link tag is disabled', async () => {
    const { document, dispatchMessage } = createTestEnvWithIframe({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);
    const link = document.querySelector('link')!;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    const iframeId = 'uuid-iframe-0';

    linkManager.start();
    await nextTick();

    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [{ requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[0] }],
    });
    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);

    link.setAttribute('disabled', '');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-iframe-1', intent: 'disable' },
    ]);
  });

  test('monetizes new URL for first tag (if valid)', async () => {
    const { document, postMessage, dispatchMessage } = createTestEnvWithIframe({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);
    const link = document.querySelector('link')!;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    const iframeId = 'uuid-iframe-0';

    linkManager.start();
    await nextTick();

    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [{ requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[0] }],
    });
    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);

    // change URL to a new valid one
    link.href = WALLET_ADDRESS[1];
    await nextTick();

    // should stop the first monetization
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-iframe-1', intent: 'remove' },
    ]);

    // should validate and start monetization with new URL
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          { requestId: 'uuid-iframe-2', walletAddress: WALLET_INFO[1] },
        ],
      }),
      '*',
    );
  });

  test.failing('monetizes prepended link tag', async () => {
    const { document, postMessage, dispatchMessage } = createTestEnvWithIframe({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);
    const originalLink = document.querySelector('link')!;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    const iframeId = 'uuid-iframe-0';

    linkManager.start();
    await nextTick();

    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [{ requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[0] }],
    });
    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);

    // prepend a new link tag (in iframe, should become the new active link)
    const newLink = createLink(document, WALLET_ADDRESS[1]);
    document.head.insertBefore(newLink, originalLink);
    await nextTick();

    // should stop the first monetization
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-iframe-1', intent: 'remove' },
    ]);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          { requestId: 'uuid-iframe-2', walletAddress: WALLET_INFO[1] },
        ],
      }),
      '*',
    );
  });

  test.failing('promotes second link tag if first is disabled', async () => {
    const { document, postMessage, dispatchMessage } = createTestEnvWithIframe({
      head: html`
        <link id="first" rel="monetization" href="${WALLET_ADDRESS[0]}">
        <link id="second" rel="monetization" href="${WALLET_ADDRESS[1]}">
      `,
    });
    using linkManager = createMonetizationLinkManager(document);
    const firstLink = document.getElementById('first') as HTMLLinkElement;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    const iframeId = 'uuid-iframe-0';

    linkManager.start();
    await nextTick();

    // only first link should be validated initially
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(1);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledWith({
      walletAddressUrl: WALLET_ADDRESS[0],
    });

    // simulate response from top frame to allow monetization
    dispatchMessage({
      message: 'START_MONETIZATION',
      id: iframeId,
      payload: [{ requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[0] }],
    });

    firstLink.setAttribute('disabled', '');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-iframe-1', intent: 'disable' },
    ]);

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          { requestId: 'uuid-iframe-2', walletAddress: WALLET_INFO[1] },
        ],
      }),
      '*',
    );
  });

  test.failing(
    'promotes second link tag if first has invalid URL',
    async () => {
      const { document, postMessage } = createTestEnvWithIframe({
        head: html`
        <link id="first" rel="monetization" href="invalid://address">
        <link id="second" rel="monetization" href="${WALLET_ADDRESS[0]}">
      `,
      });
      using linkManager = createMonetizationLinkManager(document);
      const firstLink = document.getElementById('first') as HTMLLinkElement;
      const secondLink = document.getElementById('second') as HTMLLinkElement;

      msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
        failure('Invalid wallet address URL'),
      );
      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_INFO[0]),
      );

      const dispatchEventSpy1 = jest.spyOn(firstLink, 'dispatchEvent');
      const dispatchEventSpy2 = jest.spyOn(secondLink, 'dispatchEvent');

      linkManager.start();
      await nextTick();

      // first link should trigger error event
      expect(dispatchEventSpy1).toHaveBeenCalledWith(new Event('error'));

      // second link should be validated and used
      expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
        walletAddressUrl: WALLET_ADDRESS[0],
      });
      expect(dispatchEventSpy2).toHaveBeenCalledWith(new Event('load'));

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'IS_MONETIZATION_ALLOWED_ON_START',
          payload: [
            { requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[0] },
          ],
        }),
        '*',
      );
    },
  );

  test.failing(
    'promotes second link tag if first has invalid URL (dynamic)',
    async () => {
      const { document, postMessage, dispatchMessage } =
        createTestEnvWithIframe({
          head: html`<link id="first" rel="monetization" href="${WALLET_ADDRESS[0]}">`,
        });
      using linkManager = createMonetizationLinkManager(document);
      const firstLink = document.getElementById('first') as HTMLLinkElement;

      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_INFO[0]),
      );
      msg.GET_WALLET_ADDRESS_INFO.mockRejectedValueOnce(
        failure('Invalid wallet address URL'),
      );
      msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(
        success(WALLET_INFO[1]),
      );

      const iframeId = 'uuid-iframe-0';

      linkManager.start();
      await nextTick();

      dispatchMessage({
        message: 'START_MONETIZATION',
        id: iframeId,
        payload: [
          { requestId: 'uuid-iframe-1', walletAddress: WALLET_INFO[0] },
        ],
      });

      firstLink.href = 'invalid://address';
      await nextTick();

      // add a second valid link, dynamic
      const secondLink = createLink(document, WALLET_ADDRESS[1]);
      document.head.appendChild(secondLink);
      await nextTick();

      expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
        { requestId: 'uuid-iframe-1', intent: 'remove' },
      ]);

      expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(3, {
        walletAddressUrl: WALLET_ADDRESS[1],
      });

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'IS_MONETIZATION_ALLOWED_ON_START',
          payload: [
            { requestId: 'uuid-iframe-2', walletAddress: WALLET_INFO[1] },
          ],
        }),
        '*',
      );
    },
  );
});

describe('link tag attributes changes', () => {
  test('handles monetization link href attribute change', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();
    await nextTick();

    document.querySelector('link')!.href = WALLET_ADDRESS[1];
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', intent: 'remove' },
    ]);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      { requestId: 'uuid-2', walletAddress: WALLET_INFO[1] },
    ]);
  });

  test('handles monetization link disabled attribute change', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const requestId = 'uuid-1';
    const link = document.querySelector('link')!;
    link.setAttribute('disabled', '');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'disable' },
    ]);

    link.removeAttribute('disabled');
    await nextTick();

    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      { requestId, walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('handles monetization link rel attribute change', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    const requestId = 'uuid-1';

    linkManager.start();
    await nextTick();

    const link = document.querySelector('link')!;
    link.setAttribute('rel', 'preload');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' },
    ]);

    link.setAttribute('rel', 'monetization');
    await nextTick();

    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId, walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('handles onmonetization attribute change', async () => {
    const { document } = createTestEnv({
      head: html`<div onmonetization="handleEvent()"></div>`,
    });
    using linkManager = createMonetizationLinkManager(document);
    const div = document.querySelector('div')!;

    linkManager.start();
    const dispatchEventSpy = jest.spyOn(div, 'dispatchEvent');

    div.setAttribute('onmonetization', 'newHandler()');
    await nextTick();

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '__wm_ext_onmonetization_attr_change',
        detail: { attribute: 'newHandler()' },
      }),
    );
  });

  test('handles onmonetization attribute change on parent', async () => {
    const { document } = createTestEnv({
      head: html`
        <div id="parent">
          <div id="child"></div>
        </div>
      `,
    });
    using linkManager = createMonetizationLinkManager(document);
    const parent = document.getElementById('parent')!;
    const child = document.getElementById('child')!;

    linkManager.start();
    const parentDispatchSpy = jest.spyOn(parent, 'dispatchEvent');
    const childDispatchSpy = jest.spyOn(child, 'dispatchEvent');

    parent.setAttribute('onmonetization', 'parentHandler()');
    await nextTick();

    expect(parentDispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '__wm_ext_onmonetization_attr_change',
        detail: { attribute: 'parentHandler()' },
      }),
    );
    expect(childDispatchSpy).not.toHaveBeenCalled();

    parent.removeAttribute('onmonetization');
    await nextTick();

    expect(parentDispatchSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: '__wm_ext_onmonetization_attr_change',
        detail: { attribute: null },
      }),
    );
  });
});

describe('document events', () => {
  test('stops & resumes on document visibility change event', async () => {
    const { document, window, documentVisibilityState } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    documentVisibilityState.mockReturnValueOnce('hidden');
    document.dispatchEvent(new window.Event('visibilitychange'));
    await nextTick();

    const requestId = 'uuid-1';
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([{ requestId }]);

    documentVisibilityState.mockReturnValueOnce('visible');
    document.dispatchEvent(new window.Event('visibilitychange'));

    expect(msg.RESUME_MONETIZATION).toHaveBeenCalledWith([
      { requestId, walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('stops on pagehide event', async () => {
    const { document, window } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    window.dispatchEvent(new window.Event('pagehide'));

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: 'uuid-1', intent: 'remove' },
    ]);
  });

  test('passes back focus events', async () => {
    const { document, window } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

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
  test('dispatches load event exactly once per validated link', async () => {
    const { document } = createTestEnv({
      head: html`
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">
        <link rel="monetization" href="${WALLET_ADDRESS[1]}">
      `,
    });
    using linkManager = createMonetizationLinkManager(document);

    const dispatchEventSpies = [...document.querySelectorAll('link')].map(
      (link) => jest.spyOn(link, 'dispatchEvent'),
    );
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
    expect(
      dispatchEventSpies.reduce((t, e) => e.mock.calls.length + t, 0),
    ).toBe(dispatchEventSpies.length);
  });

  test('dispatches load event once when link is modified, but link remains valid', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    const link = document.querySelector('link')!;
    const dispatchEventSpy = jest.spyOn(link, 'dispatchEvent');
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));

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

  test('handles load events correctly when replacing a link element', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    using linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    const originalLink = document.querySelector('link')!;
    const originalDispatchSpy = jest.spyOn(originalLink, 'dispatchEvent');

    linkManager.start();
    await nextTick();

    expect(
      originalDispatchSpy.mock.calls.filter(
        (call) => (call[0] as Event).type === 'load',
      ),
    ).toHaveLength(1);

    // replace the link with a new one
    const newLink = createLink(document, WALLET_ADDRESS[1]);
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

  test('does not dispatch load event for invalid links', async () => {
    const { document } = createTestEnv({
      head: html`
        <link rel="monetization" href="invalid://url">
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">
      `,
    });
    using linkManager = createMonetizationLinkManager(document);

    const [invalidLink, validLink] = document.querySelectorAll('link');
    const invalidLinkSpy = jest.spyOn(invalidLink, 'dispatchEvent');
    const validLinkSpy = jest.spyOn(validLink, 'dispatchEvent');

    msg.GET_WALLET_ADDRESS_INFO.mockRejectedValue(failure('Invalid URL'));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValue(success(WALLET_INFO[0]));

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
