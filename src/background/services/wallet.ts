import {
  ErrorWithKey,
  errorWithKeyToJSON,
  getConnectWalletBudgetInfo,
  getWalletInformation,
  isAbortSignalTimeout,
  isErrorWithKey,
  isKeyAddedToWallet,
  toWalletAddressUrl,
  type ErrorWithKeyLike,
  type I18nInfo,
} from '@/shared/helpers';
import type {
  AddFundsPayload,
  ConnectWalletAddressInfo,
  ConnectWalletPayload,
  ReconnectWalletPayload,
  UpdateBudgetPayload,
} from '@/shared/messages';
import { OPEN_PAYMENTS_REDIRECT_URL } from '@/shared/defines';
import {
  redirectToPostConnect,
  toAmount,
  onPopupOpen,
  closeTabsByFilter,
  highlightTab,
  WalletStatusFailureError,
  WalletStatusCancelError,
} from '@/background/utils';
import { KeyAutoAddService } from '@/background/services/keyAutoAdd';
import { generateEd25519KeyPair, exportJWK } from '@/shared/crypto';
import {
  isInvalidClientError,
  isOpenPaymentsClientError,
} from '@/background/services/openPayments';
import { APP_URL } from '@/background/constants';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { Cradle } from '@/background/container';
import type {
  WalletStatusFailure,
  WalletStatus,
  WalletStatusRetryMessage,
  TabId,
  WalletInfo,
} from '@/shared/types';
import type { Browser, Tabs } from 'webextension-polyfill';

export class WalletService {
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private storage: Cradle['storage'];
  private events: Cradle['events'];
  private browser: Cradle['browser'];
  private telemetry: Cradle['telemetry'];
  private logger: Cradle['logger'];
  private t: Cradle['t'];

  constructor({
    outgoingPaymentGrantService,
    openPaymentsService,
    storage,
    events,
    browser,
    telemetry,
    logger,
    t,
  }: Cradle) {
    this.outgoingPaymentGrantService = outgoingPaymentGrantService;
    this.openPaymentsService = openPaymentsService;
    this.storage = storage;
    this.events = events;
    this.browser = browser;
    this.telemetry = telemetry;
    this.logger = logger;
    this.t = t;
  }

  async getConnectWalletInfo(
    walletAddressUrl: string,
  ): Promise<ConnectWalletAddressInfo> {
    const url = toWalletAddressUrl(walletAddressUrl);
    const walletAddress = await getWalletInformation(url);
    const { keyId } = await this.storage.get(['keyId']);
    const [budgetInfo, isKeyAdded] = await Promise.all([
      getConnectWalletBudgetInfo(walletAddress),
      isKeyAddedToWallet(walletAddress.id, keyId),
    ]);
    return {
      walletAddress: { ...walletAddress, url },
      isKeyAdded,
      isKeyAutoAddSupported: KeyAutoAddService.supports(walletAddress),
      ...budgetInfo,
    };
  }

  async connectWallet(params: ConnectWalletPayload) {
    const startTime = Date.now();
    const {
      walletAddress,
      rateOfPay,
      maxRateOfPay,
      amount,
      recurring,
      autoKeyAdd,
    } = params;

    await this.generateKeys();
    const { keyId } = await this.storage.get(['keyId']);
    await this.openPaymentsService.initClient(walletAddress.id);

    const browser = this.browser;

    const isKeyAdded = await isKeyAddedToWallet(walletAddress.id, keyId);
    if (!isKeyAdded) {
      if (!autoKeyAdd) {
        throw new ErrorWithKey('connectWallet_error_invalidClient');
      }
      if (!KeyAutoAddService.supports(walletAddress)) {
        throw new ErrorWithKey('connectWalletKeyService_error_notImplemented');
      }
    }

    let tabId: TabId | undefined;
    let cleanupListeners: () => void = () => {};

    if (!isKeyAdded && autoKeyAdd) {
      try {
        this.setConnectStateProgress('connect', {
          key: 'connectWalletKeyService_text_stepAddKey',
          substitutions: [],
        });
        await closeAppTabs(this.browser);
        await this.addPublicKeyToWallet(walletAddress, (openedTabId) => {
          tabId = openedTabId;
          cleanupListeners = highlightTabOnPopupOpen(browser, tabId);
        });
      } catch (error) {
        cleanupListeners();
        const err = this.setConnectStateError(error, 'connect', {
          action: 'CONNECT_WALLET',
          payload: params,
        });
        await this.redirectOnGrantError(err || error, tabId);
        throw err || error;
      }
    }

    const walletAmount = toAmount({
      value: amount,
      recurring,
      assetScale: walletAddress.assetScale,
    });

    try {
      const grant =
        await this.outgoingPaymentGrantService.createOutgoingPaymentGrant(
          walletAddress,
          walletAmount,
        );

      // In Safari, connect process crashes with "tab closed" error if we reuse
      // the tab. So, instead of reusing, close the app tab and open a new one -
      // goal is to not have too many extension tabs for user. This is also
      // better than re-using (`tabs.update`) as it gives more consistent user
      // experience.
      await closeAppTabs(this.browser);

      this.setConnectStateProgress('connect', {
        key: 'connectWallet_text_stepAcceptGrant',
        substitutions: [],
      });
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        walletAmount,
        walletAddress,
        grant,
        (openedTabId) => {
          tabId = openedTabId;
          cleanupListeners = highlightTabOnPopupOpen(browser, tabId);
        },
        tabId,
      );
      cleanupListeners();
    } catch (error) {
      cleanupListeners();
      const err = this.setConnectStateError(error, 'connect', {
        action: 'CONNECT_WALLET',
        payload: params,
      });
      await this.redirectOnGrantError(err || error, tabId);
      throw err || error;
    }

    this.storage.setTransientState('connect', () => ({
      intent: 'connect',
      type: 'success',
    }));
    await this.redirectOnSuccess(tabId);
    await this.storage.set({
      walletAddress,
      rateOfPay,
      maxRateOfPay,
      connected: true,
    });
    this.telemetry.capture('connect_wallet_success', {
      recurringEnabled: recurring,
      duration: Date.now() - startTime,
    });
  }

  async reconnectWallet(payload: ReconnectWalletPayload) {
    const { autoKeyAddConsent } = payload;
    if (!autoKeyAddConsent) {
      await this.validateReconnect().catch((error) => {
        this.setConnectStateError(error?.cause || error, 'reconnect', {
          action: 'RECONNECT_WALLET',
          payload,
        });
        throw error;
      });
      return;
    }

    const { walletAddress } = await this.storage.get(['walletAddress']);
    if (!walletAddress) {
      throw new Error('reconnectWallet_error_walletAddressMissing');
    }
    if (!KeyAutoAddService.supports(walletAddress)) {
      throw new ErrorWithKey('connectWalletKeyService_error_notImplemented');
    }

    this.setConnectStateProgress('reconnect', 'Reconnecting wallet');
    try {
      await this.validateReconnect();
    } catch (error) {
      if (!isInvalidClientError(error?.cause)) {
        this.setConnectStateError(new Error(error.message), 'reconnect', {
          action: 'RECONNECT_WALLET',
          payload,
        });
        throw error;
      }
    }

    await closeAppTabs(this.browser);
    // add key to wallet and try again
    let tabId: TabId | undefined;
    try {
      await this.addPublicKeyToWallet(
        walletAddress,
        (openedTabId) => (tabId = openedTabId),
        'reconnect',
      );
      await this.outgoingPaymentGrantService.rotateToken();
      await this.storage.setState({ key_revoked: false });
    } catch (error) {
      this.setConnectStateError(error, 'reconnect', {
        action: 'RECONNECT_WALLET',
        payload,
      });
      const isTabClosed =
        error instanceof WalletStatusCancelError && error.code === 'tab_closed';

      if (tabId && !isTabClosed) {
        await this.redirectOnGrantError(error, tabId);
      }

      if (isInvalidClientError(error)) {
        throw new ErrorWithKey('connectWallet_error_invalidClient');
      }
      throw error;
    }

    this.storage.setTransientState('connect', () => ({
      type: 'success',
      intent: 'reconnect',
    }));
    await this.redirectOnSuccess(tabId);
  }

  async disconnectWallet(force = false) {
    const { recurringGrant, oneTimeGrant } = await this.storage.get([
      'recurringGrant',
      'oneTimeGrant',
    ]);
    if (!recurringGrant && !oneTimeGrant) {
      return;
    }

    const handleError = (
      err: unknown,
      grantType: 'recurring' | 'oneTime',
      force: boolean,
    ) => {
      this.logger.error(`Could not cancel ${grantType} grant`, { err });
      if (force) return;

      if (isOpenPaymentsClientError(err)) {
        throw new ErrorWithKey('disconnectWallet_error_generic', [
          err.status ? `HTTP ${err.status} - ${err.message}` : err.message,
        ]);
      }
      throw err;
    };

    if (recurringGrant) {
      await this.outgoingPaymentGrantService
        .cancelGrant(recurringGrant.continue)
        .catch((err) => handleError(err, 'recurring', force));
      this.outgoingPaymentGrantService.disableRecurringGrant();
    }
    if (oneTimeGrant) {
      await this.outgoingPaymentGrantService
        .cancelGrant(oneTimeGrant.continue)
        .catch((err) => handleError(err, 'recurring', force));
      this.outgoingPaymentGrantService.disableOneTimeGrant();
    }
    await this.storage.clear();
  }

  async addFunds(payload: AddFundsPayload) {
    const { amount, recurring } = payload;
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

    const grant =
      await this.outgoingPaymentGrantService.createOutgoingPaymentGrant(
        walletAddress,
        walletAmount,
      );
    await closeAppTabs(this.browser);
    let tabId: TabId | undefined;
    try {
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        walletAmount,
        walletAddress,
        grant,
        (openedTabId) => {
          tabId = openedTabId;
        },
      );
    } catch (error) {
      const err = this.setConnectStateError(error, 'add_funds', {
        action: 'ADD_FUNDS',
        payload,
      });
      await this.redirectOnGrantError(err || error, tabId);
      throw err || error;
    }

    await this.storage.setState({ out_of_funds: false });

    this.storage.setTransientState('connect', () => ({
      intent: 'add_funds',
      type: 'success',
    }));
    await this.redirectOnSuccess(tabId);

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

  async updateBudget(payload: UpdateBudgetPayload) {
    const { amount, recurring } = payload;
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

    const grant =
      await this.outgoingPaymentGrantService.createOutgoingPaymentGrant(
        walletAddress,
        walletAmount,
      );
    await closeAppTabs(this.browser);
    let tabId: TabId | undefined;
    try {
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        walletAmount,
        walletAddress,
        grant,
        (openedTabId) => {
          tabId = openedTabId;
        },
      );
    } catch (error) {
      const err = this.setConnectStateError(error, 'update_budget', {
        action: 'UPDATE_BUDGET',
        payload,
      });
      await this.redirectOnGrantError(err || error, tabId);
      throw err || error;
    }

    this.storage.setTransientState('connect', () => ({
      intent: 'update_budget',
      type: 'success',
    }));
    await this.redirectOnSuccess(tabId);

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
   */
  private async addPublicKeyToWallet(
    walletAddress: WalletInfo,
    onTabOpen: (tabId: TabId) => void,
    intent: WalletStatus['intent'] = 'connect',
  ) {
    const keyAutoAdd = new KeyAutoAddService({
      browser: this.browser,
      storage: this.storage,
      telemetry: this.telemetry,
      t: this.t,
    });
    this.events.emit('request_popup_close');
    await keyAutoAdd.addPublicKeyToWallet(
      walletAddress,
      (openedTabId) => onTabOpen(openedTabId),
      intent,
    );
  }

  private async validateReconnect() {
    try {
      await this.outgoingPaymentGrantService.rotateToken();
    } catch (error) {
      if (isInvalidClientError(error)) {
        throw new Error('connectWallet_error_invalidClient', { cause: error });
      }
      throw error;
    }
    await this.storage.setState({ key_revoked: false });
  }

  private async redirectOnSuccess(tabId?: TabId) {
    await redirectToPostConnect(this.browser, tabId);
  }

  private async redirectOnGrantError(error: Error, tabId?: TabId) {
    if (error instanceof WalletStatusCancelError) {
      if (error.code === 'tab_closed') {
        return;
      }
    }
    await redirectToPostConnect(this.browser, tabId);
  }

  public resetConnectState() {
    this.storage.setTransientState('connect', () => null);
  }

  private setConnectStateProgress(
    intent: WalletStatus['intent'],
    currentStep: string | I18nInfo,
  ) {
    this.storage.setTransientState('connect', () => ({
      type: 'progress',
      intent,
      currentStep,
    }));
  }

  private setConnectStateError(
    error:
      | WalletStatusFailureError
      | WalletStatusCancelError
      | ErrorWithKeyLike
      | DOMException
      | Error,
    intent: WalletStatusFailure['intent'],
    retryMessage: WalletStatusRetryMessage,
  ) {
    const setFail = (data: Omit<WalletStatusFailure, 'intent' | 'type'>) => {
      this.storage.setTransientState('connect', (state) => {
        if (state?.type === 'failure') return { retryMessage, ...state };
        return { type: 'failure', retryMessage, intent, ...data };
      });
    };

    if (error instanceof WalletStatusFailureError) {
      return setFail({
        code: error.code,
        retryPossible: 'auto',
        details: error.details,
      });
    }

    if (error instanceof WalletStatusCancelError) {
      return this.storage.setTransientState('connect', () => ({
        type: 'cancel',
        intent,
        code: error.code,
        retryPossible: 'auto',
        retryMessage,
      }));
    }

    if (isAbortSignalTimeout(error)) {
      setFail({ code: 'timeout', retryPossible: 'auto' });
      return new WalletStatusFailureError('timeout');
    }

    if (isErrorWithKey(error)) {
      if (error.key.includes('connectWalletKeyService_error_')) {
        setFail({
          code: 'key_add_failed',
          retryPossible: 'auto',
          details: errorWithKeyToJSON(error),
        });
        return;
      }
    }

    setFail({
      code: 'unknown',
      retryPossible: 'auto',
      details: isErrorWithKey(error)
        ? errorWithKeyToJSON(error)
        : { message: error.message },
    });
  }
}

async function closeAppTabs(browser: Browser) {
  const appUrl = browser.runtime.getURL(APP_URL);
  const filter = (tab: Tabs.Tab) => {
    const tabUrl = tab.url;
    if (!tabUrl) return false;
    return (
      tabUrl.startsWith(appUrl) || tabUrl.startsWith(OPEN_PAYMENTS_REDIRECT_URL)
    );
  };
  await closeTabsByFilter(browser, filter);
}

// on popup opened, let's highlight the tab if user has lost it
const highlightTabOnPopupOpen = (browser: Browser, tabId: TabId) => {
  return onPopupOpen(browser, async () => highlightTab(browser, tabId));
};
