import { promisify } from 'node:util';
import { JSDOM } from 'jsdom';
import { MonetizationLinkManager } from '@/content/services/monetizationLinkManager';
import { success, failure } from '@/shared/helpers';
import type {
  ContentToBackgroundMessage,
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
  const { window, document, documentReadyState } = createTestEnv({
    body: html`<iframe id="${id}" allow="${allow}"></iframe>`,
    readyState,
  });
  const iframe = document.getElementsByTagName('iframe')[0];
  const iframeDocument = iframe.contentDocument!;
  const iframeWindow = iframe.contentWindow!.window;

  if (head) iframeDocument.head.insertAdjacentHTML('afterbegin', head);
  if (body) iframeDocument.body.insertAdjacentHTML('afterbegin', body);

  return {
    document: iframeDocument,
    window: iframeWindow,
    iframe,
    host: {
      window,
      document,
      documentReadyState,
    },
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

  // @ts-expect-error let it go
  global.crypto.randomUUID = requestIdMock;
});

describe('monetization in main frame', () => {
  test('should detect monetization link tags', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const linkManager = createMonetizationLinkManager(document);

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
      { requestId, walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('should stop monetization on link element removal', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    document.querySelector('link')!.remove();

    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' },
    ]);
  });

  test('should stop monetization when parent of link tag is removed', async () => {
    const { document } = createTestEnv({
      head: html`<div id="container">
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">
      </div>`,
    });
    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const requestId = requestIdMock.mock.results.at(-1)!.value;
    document.getElementById('container')!.remove();
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' },
    ]);
  });

  test('should start monetization when an element containing link tag is added', async () => {
    const { document } = createTestEnv();
    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const newContainer = document.createElement('div');
    newContainer.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[0]}">`;
    document.head.appendChild(newContainer);
    await nextTick();

    const requestId = requestIdMock.mock.results.at(-1)!.value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId, walletAddress: WALLET_INFO[0] },
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

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));

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
      { requestId: walletAddress1RequestId, walletAddress: WALLET_INFO[0] },
      { requestId: walletAddress2RequestId, walletAddress: WALLET_INFO[1] },
    ]);
  });

  test('should reject invalid wallet address URL', async () => {
    const { document } = createTestEnv({
      head: html`
        <link rel="monetization" href="invalid-url">
        <link rel="monetization" href="https://example.com">
      `,
    });
    const linkManager = createMonetizationLinkManager(document);

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

  test('should handle dynamically added monetization link', async () => {
    const { document } = createTestEnv({});
    const linkManager = createMonetizationLinkManager(document);

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

    const requestId = requestIdMock.mock.results[1].value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId, walletAddress: WALLET_INFO[0] },
    ]);
  });

  test('should handle dynamic link tag append and remove', async () => {
    const { document } = createTestEnv({});
    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const wrapper = document.createElement('div');
    wrapper.append(createLink(document, WALLET_ADDRESS[0]));
    document.head.appendChild(wrapper);
    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId, walletAddress: WALLET_INFO[0] },
    ]);

    wrapper.remove();
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' },
    ]);
  });

  test('should handle two link tags added simultaneously', async () => {
    const { document } = createTestEnv({});
    const linkManager = createMonetizationLinkManager(document);

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

    const requestId1 = requestIdMock.mock.results[1].value;
    const requestId2 = requestIdMock.mock.results[2].value;

    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(2);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(1, {
      walletAddressUrl: WALLET_ADDRESS[0],
    });
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: requestId1, walletAddress: WALLET_INFO[0] },
      { requestId: requestId2, walletAddress: WALLET_INFO[1] },
    ]);

    // verify that both links are being observed for attribute changes
    link1.href = 'https://ilp.interledger-test.dev/tech1-updated';
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: requestId1, intent: 'remove' },
    ]);
  });

  test('more link tags added right after, leading to another MutationObserver callback', async () => {
    const { document } = createTestEnv({});
    const linkManager = createMonetizationLinkManager(document);

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

    const requestId1 = requestIdMock.mock.results[1].value;
    const requestId2 = requestIdMock.mock.results[2].value;
    const requestId3 = requestIdMock.mock.results[3].value;
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(3);
    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(2);
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(1, [
      { requestId: requestId1, walletAddress: WALLET_INFO[0] },
    ]);
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      { requestId: requestId2, walletAddress: WALLET_INFO[1] },
      { requestId: requestId3, walletAddress: WALLET_INFO[2] },
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

    const link = document.querySelector('link')!;
    const requestId = requestIdMock.mock.results[1].value;

    link.setAttribute('disabled', '');
    link.removeAttribute('disabled');
    link.href = 'https://ilp.interledger-test.dev/new';
    link.setAttribute('rel', 'preload');
    link.setAttribute('rel', 'monetization');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' }, // TODO: should this in end lead to START?
    ]);
    expect(msg.STOP_MONETIZATION).toHaveBeenCalledTimes(1);
  });

  test('should handle concurrent validation of multiple links with some failing', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const linkManager = createMonetizationLinkManager(document);
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

    const requestId1 = requestIdMock.mock.results[1].value;
    const requestId2 = requestIdMock.mock.results[2].value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: requestId1, walletAddress: WALLET_INFO[0] },
      { requestId: requestId2, walletAddress: WALLET_INFO[1] },
    ]);

    const errorEvent = errorSpy.mock.lastCall![0] as Event;
    expect(errorEvent.type).toBe('error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
  });
});

describe('monetization in first level iframe', () => {
  test('detect monetization links in head', async () => {
    const { document, window } = createTestEnvWithIframe({
      head: html`
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">
        <link rel="monetization" href="${WALLET_ADDRESS[1]}">
      `,
    });
    const linkManager = createMonetizationLinkManager(document);
    const link = document.querySelector('link')!;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    const dispatchEvent = jest.spyOn(link, 'dispatchEvent');
    const postMessage = jest.spyOn(window.parent, 'postMessage');
    const iframeId = requestIdMock.mock.results[0].value;

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
          {
            requestId: iframeWARequestId,
            walletAddress: WALLET_INFO[0],
          },
        ],
      },
      '*',
    );

    const messageEvent = new window.MessageEvent('message', {
      data: {
        message: 'START_MONETIZATION',
        id: iframeId,
        payload: [
          { requestId: iframeWARequestId, walletAddress: WALLET_INFO[0] },
        ],
      },
    });
    window.dispatchEvent(messageEvent);

    expect(msg.START_MONETIZATION).toHaveBeenCalledTimes(1);
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      {
        requestId: iframeWARequestId,
        walletAddress: WALLET_INFO[0],
      },
    ]);
  });

  test.todo('ignore monetization links in body');

  test.failing('handle only first link tag', async () => {
    // also test disabling a link tag in iframe, changing URL of first link tag, and prepending another link tag
    const { document, window } = createTestEnvWithIframe({
      head: html`
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const linkManager = createMonetizationLinkManager(document);
    const link1 = document.querySelector('link')!;

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[2]));

    const postMessageSpy = jest.spyOn(window.parent, 'postMessage');
    const iframeId = requestIdMock.mock.results[0].value;

    linkManager.start();
    await nextTick();
    // TODO: check START_MONETIZATION

    const firstRequestId = requestIdMock.mock.results[1].value;
    // test disable first link tag in iframe
    link1.setAttribute('disabled', '');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: firstRequestId, intent: 'disable' },
    ]);

    // test first link URL change
    link1.removeAttribute('disabled');
    link1.href = WALLET_ADDRESS[1];
    await nextTick();

    const secondRequestId = requestIdMock.mock.results[2].value;
    // prepend another link (should be ignored in iframe)
    const link2 = createLink(document, WALLET_ADDRESS[2]);
    document.head.insertBefore(link2, link1);
    await nextTick();

    // Verify only the first link is active
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenCalledTimes(2);
    expect(postMessageSpy).toHaveBeenLastCalledWith(
      {
        id: iframeId,
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [
          { requestId: secondRequestId, walletAddress: WALLET_INFO[1] },
        ],
      },
      '*',
    );
    // TODO: check START_MONETIZATION
  });

  test.failing('handle dynamically added monetization link', async () => {
    const { document, window } = createTestEnvWithIframe();
    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));
    const postMessageSpy = jest.spyOn(window.parent, 'postMessage');
    const iframeId = requestIdMock.mock.results[0].value;

    linkManager.start();

    // append body
    const wrapper1 = document.createElement('div');
    wrapper1.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[0]}">`;
    document.body.appendChild(wrapper1);

    await nextTick();

    // append head
    const wrapper2 = document.createElement('div');
    wrapper2.innerHTML = `<link rel="monetization" href="${WALLET_ADDRESS[1]}">`;
    document.head.appendChild(wrapper2);

    await nextTick();

    const requestId = requestIdMock.mock.results.at(-1)!.value;
    // only the head link should be processed in iframe
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        id: iframeId,
        message: 'IS_MONETIZATION_ALLOWED_ON_START',
        payload: [{ requestId, walletAddress: WALLET_INFO[0] }],
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

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));
    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[1]));

    linkManager.start();
    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    document.querySelector('link')!.href = WALLET_ADDRESS[1];
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId: requestId, intent: 'remove' },
    ]);
    expect(msg.GET_WALLET_ADDRESS_INFO).toHaveBeenNthCalledWith(2, {
      walletAddressUrl: WALLET_ADDRESS[1],
    });

    const requestIdNew = requestIdMock.mock.results.at(-1)!.value;
    expect(msg.START_MONETIZATION).toHaveBeenNthCalledWith(2, [
      { requestId: requestIdNew, walletAddress: WALLET_INFO[1] },
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

  test('should handle monetization link rel attribute change', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    const link = document.querySelector('link')!;
    link.setAttribute('rel', 'preload');
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([
      { requestId, intent: 'remove' },
    ]);

    link.setAttribute('rel', 'monetization');
    await nextTick();

    const newRequestId = requestIdMock.mock.results[1].value;
    expect(msg.START_MONETIZATION).toHaveBeenCalledWith([
      { requestId: newRequestId, walletAddress: WALLET_INFO[0] },
    ]);
  });

  test.todo('should handle onmonetization attribute change');
  test.todo('should handle onmonetization attribute change on parent');
});

describe('document events', () => {
  test('should handle document visibility change event', async () => {
    const { document, window, documentVisibilityState } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const linkManager = createMonetizationLinkManager(document);

    msg.GET_WALLET_ADDRESS_INFO.mockResolvedValueOnce(success(WALLET_INFO[0]));

    linkManager.start();
    await nextTick();

    const requestId = requestIdMock.mock.results[1].value;
    documentVisibilityState.mockReturnValueOnce('hidden');
    document.dispatchEvent(new window.Event('visibilitychange'));
    await nextTick();

    expect(msg.STOP_MONETIZATION).toHaveBeenCalledWith([{ requestId }]);

    documentVisibilityState.mockReturnValueOnce('visible');
    document.dispatchEvent(new window.Event('visibilitychange'));

    expect(msg.RESUME_MONETIZATION).toHaveBeenCalledWith([
      { requestId, walletAddress: WALLET_INFO[0] },
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
    const linkManager = createMonetizationLinkManager(document);

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

  test('should dispatch load event once when link is modified, but link remains valid', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const linkManager = createMonetizationLinkManager(document);

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

  test('should handle load events correctly when replacing a link element', async () => {
    const { document } = createTestEnv({
      head: html`<link rel="monetization" href="${WALLET_ADDRESS[0]}">`,
    });
    const linkManager = createMonetizationLinkManager(document);

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

  test('should not dispatch load event for invalid links', async () => {
    const { document } = createTestEnv({
      head: html`
        <link rel="monetization" href="invalid://url">
        <link rel="monetization" href="${WALLET_ADDRESS[0]}">
      `,
    });
    const linkManager = createMonetizationLinkManager(document);

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
