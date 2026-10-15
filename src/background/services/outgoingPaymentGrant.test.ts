// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Browser } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';
import { OutgoingPaymentGrantService } from '@/background/services/outgoingPaymentGrant';
import {
  WalletStatusCancelError,
  WalletStatusFailureError,
} from '@/background/utils';

const APP_URL = 'chrome-extension://abc/pages/app/index.html';
const POST_CONNECT_URL = `${APP_URL}#/post-connect`;
const REDIRECT_URL = 'https://webmonetization.org/welcome';
const TAB_ID = 42;

type TabUpdateListener = (
  tabId: number,
  changeInfo: { url?: string },
) => Promise<void>;

function setup() {
  let onUpdated: TabUpdateListener | undefined;
  const calls: string[] = [];

  const browser = {
    runtime: { getURL: vi.fn(() => APP_URL) },
    tabs: {
      create: vi.fn(async () => ({ id: TAB_ID })),
      get: vi.fn(async () => ({ id: TAB_ID, index: 0, windowId: 1 })),
      query: vi.fn(async () => []),
      update: vi.fn(async (_tabId: number, { url }: { url: string }) => {
        calls.push(`update:${url}`);
      }),
      onUpdated: {
        addListener: vi.fn((cb: TabUpdateListener) => (onUpdated = cb)),
        removeListener: vi.fn(),
      },
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  } as unknown as Browser;

  const service = new OutgoingPaymentGrantService({
    browser,
    storage: { get: vi.fn(async () => ({})) },
    logger: { debug: vi.fn(), warn: vi.fn() },
    events: { emit: vi.fn() },
    openPaymentsService: {},
  } as unknown as Cradle);

  const getInteractionInfo = (signal = new AbortController().signal) =>
    // biome-ignore lint/complexity/useLiteralKeys: method is private
    service['getInteractionInfo'](
      'https://wallet.example/interact',
      vi.fn(),
      signal,
    );

  const navigate = async (url: string) => {
    await vi.waitFor(() => expect(onUpdated).toBeDefined());
    await onUpdated!(TAB_ID, { url });
  };

  return { browser, calls, getInteractionInfo, navigate };
}

describe('OutgoingPaymentGrantService.getInteractionInfo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to post-connect as soon as interaction params arrive', async () => {
    const { browser, calls, getInteractionInfo, navigate } = setup();

    const promise = getInteractionInfo();
    await navigate(`${REDIRECT_URL}?interact_ref=ref&hash=h`);

    await expect(promise).resolves.toEqual({
      interactRef: 'ref',
      hash: 'h',
      tabId: TAB_ID,
    });
    expect(browser.tabs.update).toHaveBeenLastCalledWith(TAB_ID, {
      url: POST_CONNECT_URL,
    });
    expect(calls.at(-1)).toBe(`update:${POST_CONNECT_URL}`);
    expect(browser.tabs.onUpdated.removeListener).toHaveBeenCalled();
  });

  it('redirects to post-connect when grant is rejected', async () => {
    const { browser, getInteractionInfo, navigate } = setup();

    const promise = getInteractionInfo();
    await navigate(`${REDIRECT_URL}?result=grant_rejected`);

    await expect(promise).rejects.toBeInstanceOf(WalletStatusCancelError);
    expect(browser.tabs.update).toHaveBeenLastCalledWith(TAB_ID, {
      url: POST_CONNECT_URL,
    });
  });

  it('redirects to post-connect when grant is invalid', async () => {
    const { browser, getInteractionInfo, navigate } = setup();

    const promise = getInteractionInfo();
    await navigate(`${REDIRECT_URL}?result=grant_invalid`);

    await expect(promise).rejects.toBeInstanceOf(WalletStatusFailureError);
    expect(browser.tabs.update).toHaveBeenLastCalledWith(TAB_ID, {
      url: POST_CONNECT_URL,
    });
  });

  it('does not redirect for unrelated navigations', async () => {
    const { browser, getInteractionInfo, navigate } = setup();

    const controller = new AbortController();
    const promise = getInteractionInfo(controller.signal);
    await navigate('https://wallet.example/login');

    expect(browser.tabs.update).not.toHaveBeenCalled();
    expect(browser.tabs.onUpdated.removeListener).not.toHaveBeenCalled();

    controller.abort();
    await expect(promise).rejects.toBeDefined();
  });

  it('still resolves if the redirect fails', async () => {
    const { browser, getInteractionInfo, navigate } = setup();
    vi.mocked(browser.tabs.update).mockRejectedValueOnce(new Error('no tab'));

    const promise = getInteractionInfo();
    await navigate(`${REDIRECT_URL}?interact_ref=ref&hash=h`);

    await expect(promise).resolves.toMatchObject({ interactRef: 'ref' });
  });
});
