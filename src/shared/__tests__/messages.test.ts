import { describe, expect, it } from 'vitest';
import {
  asBrowser,
  makeBrowser,
} from '@/background/services/__tests__/helpers';
import { ErrorWithKey } from '../helpers/i18n';
import {
  failure,
  getResponseOrThrow,
  MessageManager,
  type Response,
} from '../messages';

describe('success / failure / getResponseOrThrow', () => {
  it('getResponseOrThrow returns the payload on success', () => {
    const res: Response<number> = { success: true, payload: 42 };
    expect(getResponseOrThrow(res)).toBe(42);
  });

  it('getResponseOrThrow throws the response error when present', () => {
    const err = new ErrorWithKey('disconnectWallet_error');
    const res: Response<never> = failure(err);
    expect(() => getResponseOrThrow(res)).toThrow(err);
  });

  it('getResponseOrThrow throws a plain Error built from the message when no error is present', () => {
    const res: Response<never> = failure('something went wrong');
    expect(() => getResponseOrThrow(res)).toThrow('something went wrong');
  });

  it('failure builds an ErrorResponse from a string message', () => {
    expect(failure('oops')).toEqual({ success: false, message: 'oops' });
  });

  it('failure builds an ErrorResponse from an ErrorWithKeyLike, using its key as message', () => {
    const err = new ErrorWithKey('disconnectWallet_error', ['a']);
    expect(failure(err)).toEqual({
      success: false,
      error: err,
      message: 'disconnectWallet_error',
    });
  });
});

type TestMessages = {
  WITH_INPUT: { input: { foo: string }; output: number };
  WITHOUT_INPUT: { input: never; output: string };
  NO_PAYLOAD: { input: undefined; output: string };
};

describe('MessageManager', () => {
  it('send forwards action/payload to runtime.sendMessage and returns its result', async () => {
    const browser = makeBrowser();
    const expected = { success: true, payload: 7 };
    browser.runtime.sendMessage.mockResolvedValue(expected);

    const manager = new MessageManager<TestMessages>({
      browser: asBrowser(browser),
    });
    const res = await manager.send('WITH_INPUT', { foo: 'bar' });

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'WITH_INPUT',
      payload: { foo: 'bar' },
    });
    expect(res).toBe(expected);
  });

  it('sendToTab forwards action/payload with the given tab/frame id', async () => {
    const browser = makeBrowser();
    const expected = { success: true, payload: 'ok' };
    browser.tabs.sendMessage.mockResolvedValue(expected);

    const manager = new MessageManager<TestMessages>({
      browser: asBrowser(browser),
    });
    const res = await manager.sendToTab(5, 1, 'NO_PAYLOAD', undefined);

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      5,
      { action: 'NO_PAYLOAD', payload: undefined },
      { frameId: 1 },
    );
    expect(res).toBe(expected);
  });

  it('sendToActiveTab looks up the active tab in the current window and sends to it', async () => {
    const browser = makeBrowser();
    browser.windows.getCurrent.mockResolvedValue({ id: 9 });
    browser.tabs.query.mockResolvedValue([{ id: 123 }]);
    const expected = { success: true, payload: 'ok' };
    browser.tabs.sendMessage.mockResolvedValue(expected);

    const manager = new MessageManager<TestMessages>({
      browser: asBrowser(browser),
    });
    const res = await manager.sendToActiveTab('NO_PAYLOAD', undefined);

    expect(browser.tabs.query).toHaveBeenCalledWith({
      active: true,
      windowId: 9,
    });
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(123, {
      action: 'NO_PAYLOAD',
      payload: undefined,
    });
    expect(res).toBe(expected);
  });
});
