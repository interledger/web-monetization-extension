import {
  getWalletInformation,
  isErrorWithKey,
  ErrorWithKey,
  errorWithKeyToJSON,
  type ErrorWithKeyLike,
  isAbortSignalTimeout,
} from '@/shared/helpers';
import type {
  AddFundsPayload,
  ConnectWalletPayload,
  ReconnectWalletPayload,
  UpdateBudgetPayload,
} from '@/shared/messages';
import {
  DEFAULT_RATE_OF_PAY,
  MIN_RATE_OF_PAY,
  MAX_RATE_OF_PAY,
  DEFAULT_SCALE,
} from '@/background/config';
import {
  convertWithExchangeRate,
  getExchangeRates,
  InteractionIntent,
  ErrorCode,
  GrantResult,
  redirectToWelcomeScreen,
  reuseOrCreateTab,
  toAmount,
  onPopupOpen,
} from '@/background/utils';
import { KeyAutoAddService } from '@/background/services/keyAutoAdd';
import { generateEd25519KeyPair, exportJWK } from '@/shared/crypto';
import { isInvalidClientError } from '@/background/services/openPayments';
import { APP_URL } from '@/background/constants';
import { bytesToHex } from '@noble/hashes/utils';
import type { Cradle } from '@/background/container';
import type { AmountValue, TabId, WalletInfo } from '@/shared/types';
import type { WalletAddress } from '@interledger/open-payments';
import type { Browser } from 'webextension-polyfill';

export class WalletService {
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private storage: Cradle['storage'];
  private events: Cradle['events'];
  private browser: Cradle['browser'];
  private appName: Cradle['appName'];
  private browserName: Cradle['browserName'];
  private windowState: Cradle['windowState'];
  private t: Cradle['t'];

  constructor({
    outgoingPaymentGrantService,
    openPaymentsService,
    storage,
    events,
    browser,
    appName,
    browserName,
    windowState,
    t,
  }: Cradle) {
    Object.assign(this, {
      outgoingPaymentGrantService,
      openPaymentsService,
      storage,
      events,
      browser,
      appName,
      browserName,
      windowState,
      t,
    });
  }

  async connectWallet(params: ConnectWalletPayload) {
    const {
      walletAddressUrl,
      amount,
      recurring,
      autoKeyAdd,
      autoKeyAddConsent,
    } = params;

    const walletAddress = await getWalletInformation(walletAddressUrl);
    const exchangeRates = await getExchangeRates();

    let rateOfPay = DEFAULT_RATE_OF_PAY;
    let minRateOfPay = MIN_RATE_OF_PAY;
    let maxRateOfPay = MAX_RATE_OF_PAY;

    const getRateOfPay = (rate: AmountValue) => {
      const from = { assetCode: 'USD', assetScale: DEFAULT_SCALE };
      return convertWithExchangeRate(rate, from, walletAddress, exchangeRates);
    };
    rateOfPay = getRateOfPay(DEFAULT_RATE_OF_PAY);
    minRateOfPay = getRateOfPay(MIN_RATE_OF_PAY);
    maxRateOfPay = getRateOfPay(MAX_RATE_OF_PAY);

    await this.openPaymentsService.initClient(walletAddress.id);

    const appUrl = this.browser.runtime.getURL(APP_URL);
    const intent = InteractionIntent.CONNECT;

    const onTimeoutAbort = (): never => {
      cleanupListeners();
      const err = new ErrorWithKey('connectWallet_error_timeout');
      this.setConnectStateError(err);
      void this.redirectOnTimeout(tabId, intent);
      throw err;
    };

    const walletAmount = toAmount({
      value: amount,
      recurring,
      assetScale: walletAddress.assetScale,
    });
    let tabId: TabId;
    let cleanupListeners: () => void = () => {};
    try {
      const grant =
        await this.outgoingPaymentGrantService.createOutgoingPaymentGrant(
          walletAddress,
          walletAmount,
          intent,
        );
      tabId = await reuseOrCreateTab(
        this.browser,
        this.windowState.getCurrentWindowId(),
        (url) => url.startsWith(appUrl),
      );
      this.setConnectState(this.t('connectWallet_text_stepAcceptGrant'));
      cleanupListeners = highlightTabOnPopupOpen(this.browser, tabId);
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        walletAmount,
        walletAddress,
        grant,
        intent,
        tabId,
      );
      cleanupListeners();
    } catch (error) {
      cleanupListeners();
      if (
        isErrorWithKey(error) &&
        error.key === 'connectWallet_error_invalidClient' &&
        autoKeyAdd
      ) {
        if (!KeyAutoAddService.supports(walletAddress, walletAddressUrl)) {
          this.setConnectStateError(error);
          throw new ErrorWithKey(
            'connectWalletKeyService_error_notImplemented',
          );
        }
        if (!autoKeyAddConsent) {
          this.setConnectStateError(error);
          throw new ErrorWithKey('connectWalletKeyService_error_noConsent');
        }

        tabId = await reuseOrCreateTab(
          this.browser,
          this.windowState.getCurrentWindowId(),
          (url) => url.startsWith(appUrl),
        );
        cleanupListeners = highlightTabOnPopupOpen(this.browser, tabId);
        // add key to wallet and try again
        try {
          this.setConnectState(
            this.t('connectWalletKeyService_text_stepAddKey'),
          );
          await this.addPublicKeyToWallet(
            walletAddress,
            tabId,
            walletAddressUrl,
          );
          const grant =
            await this.outgoingPaymentGrantService.createOutgoingPaymentGrant(
              walletAddress,
              walletAmount,
              intent,
            );
          this.setConnectState(this.t('connectWallet_text_stepAcceptGrant'));
          await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
            walletAmount,
            walletAddress,
            grant,
            intent,
            tabId,
          );
          cleanupListeners();
        } catch (error) {
          if (isAbortSignalTimeout(error)) {
            onTimeoutAbort();
          }
          cleanupListeners();
          this.setConnectStateError(error);
          throw error;
        }
      } else if (isAbortSignalTimeout(error)) {
        onTimeoutAbort();
      } else {
        cleanupListeners();
        this.setConnectStateError(error);
        throw error;
      }
    }

    await this.storage.set({
      walletAddress: { url: walletAddressUrl, ...walletAddress },
      rateOfPay,
      minRateOfPay,
      maxRateOfPay,
      connected: true,
    });
    this.resetConnectState();
  }

  async reconnectWallet({ autoKeyAddConsent }: ReconnectWalletPayload) {
    if (!autoKeyAddConsent) {
      await this.validateReconnect();
      return;
    }

    const { walletAddress } = await this.storage.get(['walletAddress']);
    if (!walletAddress) {
      throw new Error('reconnectWallet_error_walletAddressMissing');
    }
    if (!KeyAutoAddService.supports(walletAddress)) {
      throw new ErrorWithKey('connectWalletKeyService_error_notImplemented');
    }
    this.setConnectState('Reconnecting wallet');

    try {
      await this.validateReconnect();
    } catch (error) {
      if (!isInvalidClientError(error?.cause)) {
        this.setConnectStateError(error);
        throw error;
      }

      try {
        // add key to wallet and try again
        await this.retryAddPublicKeyToWallet(walletAddress);
        await this.storage.setState({ key_revoked: false });
      } catch (error) {
        this.setConnectStateError(error);
        throw error;
      }
    }

    this.resetConnectState();
  }

  async disconnectWallet() {
    const { recurringGrant, oneTimeGrant } = await this.storage.get([
      'recurringGrant',
      'oneTimeGrant',
    ]);
    if (!recurringGrant && !oneTimeGrant) {
      return;
    }
    if (recurringGrant) {
      await this.outgoingPaymentGrantService.cancelGrant(
        recurringGrant.continue,
      );
      this.outgoingPaymentGrantService.disableRecurringGrant();
    }
    if (oneTimeGrant) {
      await this.outgoingPaymentGrantService.cancelGrant(oneTimeGrant.continue);
      this.outgoingPaymentGrantService.disableOneTimeGrant();
    }
    await this.storage.clear();
  }

  async addFunds({ amount, recurring }: AddFundsPayload) {
    const { walletAddress, ...grants } = await this.storage.get([
      'walletAddress',
      'oneTimeGrant',
      'recurringGrant',
    ]);
    if (!walletAddress) {
      throw new Error('Unexpected: walletAddress not found');
    }

    const walletAmount = toAmount({
      value: amount,
      recurring,
      assetScale: walletAddress.assetScale,
    });
    const intent = InteractionIntent.FUNDS;
    const grant =
      await this.outgoingPaymentGrantService.createOutgoingPaymentGrant(
        walletAddress,
        walletAmount,
        intent,
      );
    const tabId = await reuseOrCreateTab(this.browser);
    try {
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        walletAmount,
        walletAddress,
        grant,
        intent,
        tabId,
      );
    } catch (error) {
      if (isAbortSignalTimeout(error)) {
        await this.redirectOnTimeout(tabId, intent);
        throw new ErrorWithKey('connectWallet_error_timeout');
      }
      throw error;
    }

    await this.storage.setState({ out_of_funds: false });

    // cancel existing grants of same type, if any
    if (grants.oneTimeGrant && !recurring) {
      await this.outgoingPaymentGrantService.cancelGrant(
        grants.oneTimeGrant.continue,
      );
    } else if (grants.recurringGrant && recurring) {
      await this.outgoingPaymentGrantService.cancelGrant(
        grants.recurringGrant.continue,
      );
    }
  }

  async updateBudget({ amount, recurring }: UpdateBudgetPayload) {
    const { walletAddress, ...existingGrants } = await this.storage.get([
      'walletAddress',
      'oneTimeGrant',
      'recurringGrant',
    ]);
    if (!walletAddress) {
      throw new Error('Unexpected: walletAddress not found');
    }

    const walletAmount = toAmount({
      value: amount,
      recurring,
      assetScale: walletAddress.assetScale,
    });
    const intent = InteractionIntent.UPDATE_BUDGET;
    const grant =
      await this.outgoingPaymentGrantService.createOutgoingPaymentGrant(
        walletAddress,
        walletAmount,
        intent,
      );
    const tabId = await reuseOrCreateTab(this.browser);
    try {
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        walletAmount,
        walletAddress,
        grant,
        intent,
        tabId,
      );
    } catch (error) {
      if (isAbortSignalTimeout(error)) {
        await this.redirectOnTimeout(tabId, intent);
        throw new ErrorWithKey('connectWallet_error_timeout');
      }
      throw error;
    }

    // Revoke all existing grants.
    // Note: Clear storage only if new grant type is not same as previous grant
    // type (as completeGrant already sets new grant state)
    if (existingGrants.oneTimeGrant) {
      if (recurring) {
        await this.storage.set({
          oneTimeGrant: null,
          oneTimeGrantSpentAmount: '0',
        });
      }
      await this.outgoingPaymentGrantService.cancelGrant(
        existingGrants.oneTimeGrant.continue,
      );
    }
    if (existingGrants.recurringGrant) {
      if (!recurring) {
        await this.storage.set({
          recurringGrant: null,
          recurringGrantSpentAmount: '0',
        });
      }
      await this.outgoingPaymentGrantService.cancelGrant(
        existingGrants.recurringGrant.continue,
      );
    }
  }

  async generateKeys() {
    if (await this.storage.keyPairExists()) return;

    const { privateKey, publicKey } = await generateEd25519KeyPair();
    const keyId = crypto.randomUUID();
    const jwk = exportJWK(publicKey, keyId);

    await this.storage.set({
      privateKey: bytesToHex(privateKey),
      publicKey: btoa(JSON.stringify(jwk)),
      keyId,
    });
  }

  /**
   * Adds public key to wallet by "browser automation" - the content script
   * takes control of tab when the correct message is sent, and adds the key
   * through the wallet's dashboard.
   *
   * @param walletAddressUrl User provided & normalized wallet address URL
   */
  private async addPublicKeyToWallet(
    walletAddress: WalletAddress,
    tabId: TabId,
    walletAddressUrl: string,
  ) {
    const keyAutoAdd = new KeyAutoAddService({
      browser: this.browser,
      storage: this.storage,
      appName: this.appName,
      browserName: this.browserName,
      t: this.t,
    });
    this.events.emit('request_popup_close');
    try {
      await keyAutoAdd.addPublicKeyToWallet(
        walletAddress,
        tabId,
        walletAddressUrl,
      );
    } catch (error) {
      const isTabClosed = error.key === 'connectWallet_error_tabClosed';
      if (tabId && !isTabClosed) {
        await redirectToWelcomeScreen(
          this.browser,
          tabId,
          GrantResult.GRANT_ERROR,
          InteractionIntent.CONNECT,
          error.key === 'connectWallet_error_timeout'
            ? ErrorCode.TIMEOUT
            : ErrorCode.KEY_ADD_FAILED,
        );
      }
      if (error instanceof ErrorWithKey) {
        throw error;
      } else {
        // TODO: check if need to handle errors here
        throw new Error(error.message, { cause: error });
      }
    }
  }

  private async retryAddPublicKeyToWallet(walletAddress: WalletInfo) {
    const tabId = await reuseOrCreateTab(this.browser);
    try {
      await this.addPublicKeyToWallet(walletAddress, tabId, walletAddress.url);
      await this.outgoingPaymentGrantService.rotateToken();
      await redirectToWelcomeScreen(
        this.browser,
        tabId,
        GrantResult.KEY_ADD_SUCCESS,
        InteractionIntent.RECONNECT,
      );
    } catch (error) {
      const isTabClosed = error.key === 'connectWallet_error_tabClosed';
      if (tabId && !isTabClosed) {
        await redirectToWelcomeScreen(
          this.browser,
          tabId,
          GrantResult.KEY_ADD_ERROR,
          InteractionIntent.RECONNECT,
          error.key === 'connectWallet_error_timeout'
            ? ErrorCode.TIMEOUT
            : ErrorCode.KEY_ADD_FAILED,
        );
      }

      if (isInvalidClientError(error)) {
        const msg = this.t('connectWallet_error_invalidClient');
        throw new Error(msg, { cause: error });
      }
      throw error;
    }
  }

  private async validateReconnect() {
    try {
      await this.outgoingPaymentGrantService.rotateToken();
    } catch (error) {
      if (isInvalidClientError(error)) {
        const msg = this.t('connectWallet_error_invalidClient');
        throw new Error(msg, { cause: error });
      }
      throw error;
    }
    await this.storage.setState({ key_revoked: false });
  }

  private async redirectOnTimeout(tabId: TabId, intent: InteractionIntent) {
    await redirectToWelcomeScreen(
      this.browser,
      tabId,
      GrantResult.GRANT_ERROR,
      intent,
      ErrorCode.TIMEOUT,
    );
  }

  public resetConnectState() {
    this.storage.setPopupTransientState('connect', () => null);
  }

  private setConnectState(currentStep: string) {
    this.storage.setPopupTransientState('connect', () => ({
      status: 'connecting',
      currentStep,
    }));
  }

  private setConnectStateError(err: ErrorWithKeyLike | { message: string }) {
    this.storage.setPopupTransientState('connect', (state) => {
      if (state?.status === 'error:key') {
        return state;
      }
      return {
        status: 'error',
        error: isErrorWithKey(err) ? errorWithKeyToJSON(err) : err.message,
      };
    });
  }
}

// on popup opened, let's highlight the tab if user has lost it
const highlightTabOnPopupOpen = (browser: Browser, tabId: TabId) => {
  return onPopupOpen(browser, async () => {
    // Opera, Safari, Firefox Android don't support highlight API.
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/highlight#browser_compatibility
    if (typeof browser.tabs.highlight === 'undefined') return;

    // get latest tab index/windowId as that can change by the time of this call
    const { index, windowId } = await browser.tabs.get(tabId);
    await browser.tabs.highlight({ tabs: [index], windowId }).catch(() => {});
  });
};
