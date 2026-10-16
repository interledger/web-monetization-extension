// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tabs } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';
import { APP_URL } from '@/background/constants';
import {
  WalletStatusCancelError,
  WalletStatusFailureError,
} from '@/background/utils';

import { OutgoingPaymentGrantService } from '../outgoingPaymentGrant';
import { makeBrowser, makeLogger, makeStorage } from './helpers';

const POST_CONNECT_URL = `chrome-extension://ext-id/${APP_URL}#/post-connect`;
const REDIRECT_URL = 'https://webmonetization.org/welcome';
const TAB_ID = 42;

function setup() {
  const browser = makeBrowser();
  browser.tabs.create.mockResolvedValue({ id: TAB_ID });
  browser.tabs.get.mockResolvedValue({ id: TAB_ID, index: 0, windowId: 1 });

  const service = new OutgoingPaymentGrantService({
    browser,
    storage: makeStorage(),
    logger: makeLogger(),
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
    const { addListener } = browser.tabs.onUpdated;
    await vi.waitFor(() => expect(addListener).toHaveBeenCalled());
    const onUpdated = addListener.mock.calls[0][0];
    await onUpdated(TAB_ID, { url }, {} as Tabs.Tab);
  };

  return { browser, getInteractionInfo, navigate };
}

describe('OutgoingPaymentGrantService.getInteractionInfo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to post-connect as soon as interaction params arrive', async () => {
    const { browser, getInteractionInfo, navigate } = setup();

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

  it('does not redirect for unrelated navigation', async () => {
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
    browser.tabs.update.mockRejectedValueOnce(new Error('no tab'));

    const promise = getInteractionInfo();
    await navigate(`${REDIRECT_URL}?interact_ref=ref&hash=h`);

    await expect(promise).resolves.toMatchObject({ interactRef: 'ref' });
  });
});
