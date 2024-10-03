// cSpell:ignore nextjs
import { errorWithKey, ErrorWithKey, sleep } from '@/shared/helpers';
import {
  KeyAutoAdd,
  LOGIN_WAIT_TIMEOUT,
  type StepRun as Run,
} from './lib/keyAutoAdd';
import { isTimedOut, waitForElement, waitForURL } from './lib/helpers';
// #region: Steps

type IndexRouteResponse = {
  isUser: boolean;
  walletInfo: {
    walletID: string;
    url: string;
  };
};

const waitForLogin: Run<void> = async (
  { keyAddUrl },
  { skip, setNotificationSize },
) => {
  let alreadyLoggedIn = window.location.href.startsWith(keyAddUrl);
  if (!alreadyLoggedIn) setNotificationSize('notification');
  try {
    sleep(2000);
    alreadyLoggedIn = await waitForURL(
      (url) => (url.origin + url.pathname).startsWith(keyAddUrl),
      { timeout: LOGIN_WAIT_TIMEOUT },
    );
    setNotificationSize('fullscreen');
  } catch (error) {
    if (isTimedOut(error)) {
      throw new ErrorWithKey('connectWalletKeyService_error_timeoutLogin');
    }
    throw new Error(error);
  }

  if (alreadyLoggedIn) {
    skip(errorWithKey('connectWalletKeyService_error_skipAlreadyLoggedIn'));
  }
};

const findWallet: Run<{ walletId: string }> = async (
  { walletAddressUrl },
  { setNotificationSize },
) => {
  setNotificationSize('fullscreen');
  const url = `/?_data=${encodeURIComponent('routes/_index')}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    mode: 'cors',
    credentials: 'include',
  });
  const data: IndexRouteResponse = await res.json();
  if (!data?.walletInfo?.url) {
    throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound');
  }

  if (data.walletInfo.url === walletAddressUrl) {
    return { walletId: data.walletInfo.walletID };
  }

  throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound');
};

const findForm: Run<{
  form: HTMLFormElement;
  nickNameField: HTMLInputElement;
  publicKeyField: HTMLTextAreaElement;
}> = async () => {
  const pathname = '/settings/keys/add-public';
  const link = await waitForElement<HTMLAnchorElement>(`a[href="${pathname}"]`);
  link.click();
  await waitForURL((url) => url.pathname === pathname);

  const form = await waitForElement<HTMLFormElement>('form#add-public-key');
  const nickNameField = await waitForElement<HTMLInputElement>(
    'input#applicationName',
    { root: form },
  );
  const publicKeyField = await waitForElement<HTMLTextAreaElement>(
    'textarea#publicKey',
    { root: form },
  );
  return { form, nickNameField, publicKeyField };
};

const addKey: Run<void> = async ({ publicKey, nickName }, { output }) => {
  const { form, nickNameField, publicKeyField } = output(findForm);

  nickNameField.focus();
  nickNameField.value = nickName;
  nickNameField.blur();

  publicKeyField.focus();
  publicKeyField.value = publicKey;
  publicKeyField.blur();

  const submitButton = await waitForElement<HTMLButtonElement>(
    'button[type="submit"]',
    { root: form },
  );
  submitButton.click();

  await waitForURL((url) => url.pathname === '/settings/keys');
};
// #endregion

// #region: Helpers
// anything?
// #endregion

// #region: Main
new KeyAutoAdd([
  {
    name: 'Waiting for you to login',
    run: waitForLogin,
    maxDuration: LOGIN_WAIT_TIMEOUT,
  },
  { name: 'Finding wallet', run: findWallet },
  { name: 'Finding form to add public key', run: findForm },
  { name: 'Adding key', run: addKey },
]).init();
// #endregion
