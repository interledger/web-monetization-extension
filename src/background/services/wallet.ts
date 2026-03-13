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
  InteractionIntent,
  ErrorCode,
  GrantResult,
  redirectToWelcomeScreen,
  toAmount,
  onPopupOpen,
  closeTabsByFilter,
  highlightTab,
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
    Object.assign(this, {
      outgoingPaymentGrantService,
      openPaymentsService,
      storage,
      events,
      browser,
      telemetry,
      logger,
      t,
    });
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
    const appUrl = browser.runtime.getURL(APP_URL);
    const intent = InteractionIntent.CONNECT;

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

    const onTimeoutAbort = (): never => {
      cleanupListeners();
      const err = new ErrorWithKey('connectWallet_error_timeout');
      this.setConnectStateError({
        intent: 'connect',
        type: 'failure',
        code: 'timeout',
        retryPossible: 'auto',
        details: errorWithKeyToJSON(err),
      });

      void this.redirectOnGrantError(err, intent, tabId!);
      throw err;
    };

    const closeTabFilter = (tab: Tabs.Tab) => {
      const tabUrl = tab.url;
      if (!tabUrl) return false;
      return (
        tabUrl.startsWith(appUrl) ||
        tabUrl.startsWith(OPEN_PAYMENTS_REDIRECT_URL)
      );
    };

    if (!isKeyAdded && autoKeyAdd) {
      try {
        this.setConnectStateProgress('connect', {
          key: 'connectWalletKeyService_text_stepAddKey',
          substitutions: [],
        });
        await closeTabsByFilter(browser, closeTabFilter);
        await this.addPublicKeyToWallet(walletAddress, (openedTabId) => {
          tabId = openedTabId;
          cleanupListeners = highlightTabOnPopupOpen(browser, tabId);
        });
      } catch (error) {
        cleanupListeners();
        if (isAbortSignalTimeout(error)) {
          onTimeoutAbort();
        }
        this.setConnectStateError({
          intent: 'connect',
          type: 'failure',
          code: 'key_add_failed',
          retryPossible: 'auto',
          details: isErrorWithKey(error)
            ? errorWithKeyToJSON(error)
            : { message: error.message },
        });
        throw error;
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
          intent,
        );

      // In Safari, connect process crashes with "tab closed" error if we reuse
      // the tab. So, instead of reusing, close the app tab and open a new one -
      // goal is to not have too many extension tabs for user. This is also
      // better than re-using (`tabs.update`) as it gives more consistent user
      // experience.
      await closeTabsByFilter(browser, closeTabFilter);

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
      if (isAbortSignalTimeout(error)) {
        onTimeoutAbort();
      } else {
        cleanupListeners();
        this.setConnectStateErrorError(error, 'connect');
        if (isErrorWithKey(error)) {
          await this.redirectOnGrantError(error, intent, tabId!);
        }
        throw error;
      }
    }

    this.storage.setTransientState('connect', () => ({
      intent: 'connect',
      type: 'success',
    }));
    await this.redirectOnSuccess(intent, tabId);
    await this.storage.set({
      walletAddress,
      rateOfPay,
      maxRateOfPay,
      connected: true,
    });
    this.resetConnectState();
    this.telemetry.capture('connect_wallet_success', {
      recurringEnabled: recurring,
      duration: Date.now() - startTime,
    });
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
    this.setConnectStateProgress('reconnect', 'Reconnecting wallet');

    try {
      await this.validateReconnect();
    } catch (error) {
      if (!isInvalidClientError(error?.cause)) {
        // @ts-expect-error TODO
        this.setConnectStateError('reconnect', error);
        throw error;
      }

      try {
        // add key to wallet and try again
        await this.retryAddPublicKeyToWallet(walletAddress);
        await this.storage.setState({ key_revoked: false });
      } catch (error) {
        // @ts-expect-error TODO
        this.setConnectStateError('reconnect', error);
        throw error;
      }
    }

    this.resetConnectState();
    this.storage.setTransientState('connect', () => ({
      intent: 'reconnect',
      type: 'success',
    }));
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
      if (isAbortSignalTimeout(error)) {
        const err = new ErrorWithKey('connectWallet_error_timeout');
        await this.redirectOnGrantError(err, intent, tabId!);
        throw err;
      } else if (isErrorWithKey(error)) {
        await this.redirectOnGrantError(error, intent, tabId!);
      }
      throw error;
    }

    await this.storage.setState({ out_of_funds: false });

    this.storage.setTransientState('connect', () => ({
      intent: 'add_funds',
      type: 'success',
    }));
    await this.redirectOnSuccess(intent, tabId);

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
      if (isAbortSignalTimeout(error)) {
        const err = new ErrorWithKey('connectWallet_error_timeout');
        await this.redirectOnGrantError(err, intent, tabId!);
        throw err;
      } else if (isErrorWithKey(error)) {
        await this.redirectOnGrantError(error, intent, tabId!);
      }
      throw error;
    }

    this.storage.setTransientState('connect', () => ({
      intent,
      type: 'success',
    }));
    await this.redirectOnSuccess(intent, tabId);

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
  ) {
    const keyAutoAdd = new KeyAutoAddService({
      browser: this.browser,
      storage: this.storage,
      telemetry: this.telemetry,
      t: this.t,
    });
    this.events.emit('request_popup_close');
    let tabId: TabId | undefined;
    try {
      await keyAutoAdd.addPublicKeyToWallet(walletAddress, (openedTabId) => {
        tabId = openedTabId;
        onTabOpen(openedTabId);
      });
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
      if (isErrorWithKey(error)) {
        throw error;
      } else {
        // TODO: check if need to handle errors here
        throw new Error(error.message, { cause: error });
      }
    }
  }

  private async retryAddPublicKeyToWallet(walletAddress: WalletInfo) {
    let tabId: TabId | undefined;
    try {
      await this.addPublicKeyToWallet(walletAddress, (openedTabId) => {
        tabId = openedTabId;
      });
      await this.outgoingPaymentGrantService.rotateToken();
      await redirectToWelcomeScreen(
        this.browser,
        tabId!,
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
        throw new ErrorWithKey('connectWallet_error_invalidClient');
      }
      throw error;
    }
  }

  private async validateReconnect() {
    try {
      await this.outgoingPaymentGrantService.rotateToken();
    } catch (error) {
      if (isInvalidClientError(error)) {
        throw new ErrorWithKey('connectWallet_error_invalidClient');
      }
      throw error;
    }
    await this.storage.setState({ key_revoked: false });
  }

  private async redirectOnSuccess(intent: InteractionIntent, tabId?: TabId) {
    await redirectToWelcomeScreen(
      this.browser,
      tabId,
      GrantResult.GRANT_SUCCESS,
      intent,
    );
  }

  private async redirectOnGrantError(
    error: ErrorWithKeyLike,
    intent: InteractionIntent,
    tabId: TabId,
  ) {
    if (error.key === 'connectWallet_error_tabClosed') {
      return;
    }
    if (error.key === 'connectWallet_error_grantRejected') {
      return await redirectToWelcomeScreen(
        this.browser,
        tabId,
        GrantResult.GRANT_REJECTED,
        intent,
      );
    }

    let code: ErrorCode | undefined;
    if (error.key === 'connectWallet_error_hashFailed') {
      code = ErrorCode.HASH_FAILED;
    } else if (error.key === 'connectWallet_error_continuationFailed') {
      code = ErrorCode.CONTINUATION_FAILED;
    } else if (error.key === 'connectWallet_error_timeout') {
      code = ErrorCode.TIMEOUT;
    }
    await redirectToWelcomeScreen(
      this.browser,
      tabId,
      GrantResult.GRANT_ERROR,
      intent,
      code,
    );
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
    details: Extract<WalletStatus, { type: 'failure' | 'cancel' }>,
  ) {
    this.storage.setTransientState('connect', (state) => {
      if (state?.type === 'failure') return state;
      return details;
    });
  }

  private setConnectStateErrorError(
    error: Error | ErrorWithKey,
    intent: WalletStatusFailure['intent'],
  ) {
    const setFail = (data: Omit<WalletStatusFailure, 'intent' | 'type'>) => {
      this.storage.setTransientState('connect', (state) => {
        if (state?.type === 'failure') return state;
        return { type: 'failure', intent, ...data };
      });
    };

    if (!isErrorWithKey(error)) {
      this.logger.log('setConnectStateErrorError', { error });
      return setFail({
        code: 'grant_invalid',
        retryPossible: 'auto',
        details: { message: error.message },
      });
    }

    if (
      error.key === 'connectWallet_error_grantRejected' ||
      error.key === 'connectWallet_error_tabClosed'
    ) {
      return this.storage.setTransientState('connect', () => ({
        type: 'cancel',
        intent,
        code:
          error.key === 'connectWallet_error_tabClosed'
            ? 'tab_closed'
            : 'grant_rejected',
        retryPossible: 'auto',
      }));
    }

    let code: WalletStatusFailure['code'] = 'unknown';
    if (error.key === 'connectWallet_error_hashFailed') {
      code = 'grant_hash_failed';
    } else if (error.key === 'connectWallet_error_continuationFailed') {
      code = 'grant_continuation_failed';
    } else if (error.key === 'connectWallet_error_grantInvalid') {
      code = 'grant_invalid';
    }
    setFail({
      code,
      retryPossible: 'auto',
      details: errorWithKeyToJSON(error),
    });
  }
}

// on popup opened, let's highlight the tab if user has lost it
const highlightTabOnPopupOpen = (browser: Browser, tabId: TabId) => {
  return onPopupOpen(browser, async () => highlightTab(browser, tabId));
};
