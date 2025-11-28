import {
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
import type { TabId, WalletInfo } from '@/shared/types';
import type { Browser, Tabs } from 'webextension-polyfill';

export class WalletService {
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private storage: Cradle['storage'];
  private events: Cradle['events'];
  private browser: Cradle['browser'];
  private logger: Cradle['logger'];
  private t: Cradle['t'];

  constructor({
    outgoingPaymentGrantService,
    openPaymentsService,
    storage,
    events,
    browser,
    logger,
    t,
  }: Cradle) {
    Object.assign(this, {
      outgoingPaymentGrantService,
      openPaymentsService,
      storage,
      events,
      browser,
      logger,
      t,
    });
  }

  async connectWallet(params: ConnectWalletPayload) {
    const {
      walletAddress,
      rateOfPay,
      maxRateOfPay,
      amount,
      recurring,
      autoKeyAdd,
      autoKeyAddConsent,
    } = params;

    await this.generateKeys();
    await this.openPaymentsService.initClient(walletAddress.id);

    const browser = this.browser;
    const appUrl = browser.runtime.getURL(APP_URL);
    const intent = InteractionIntent.CONNECT;

    const onTimeoutAbort = (): never => {
      cleanupListeners();
      const err = new ErrorWithKey('connectWallet_error_timeout');
      this.setConnectStateError(err);

      void this.redirectOnTimeout(intent, tabId);
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

    const walletAmount = toAmount({
      value: amount,
      recurring,
      assetScale: walletAddress.assetScale,
    });

    let tabId: TabId | undefined;
    let cleanupListeners: () => void = () => {};
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

      this.setConnectState(this.t('connectWallet_text_stepAcceptGrant'));
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        walletAmount,
        walletAddress,
        grant,
        intent,
        (openedTabId) => {
          tabId = openedTabId;
          cleanupListeners = highlightTabOnPopupOpen(browser, tabId);
        },
      );
      cleanupListeners();
    } catch (error) {
      cleanupListeners();
      if (
        isErrorWithKey(error) &&
        error.key === 'connectWallet_error_invalidClient' &&
        autoKeyAdd
      ) {
        if (!KeyAutoAddService.supports(walletAddress)) {
          this.setConnectStateError(error);
          throw new ErrorWithKey(
            'connectWalletKeyService_error_notImplemented',
          );
        }
        if (!autoKeyAddConsent) {
          this.setConnectStateError(error);
          throw new ErrorWithKey('connectWalletKeyService_error_noConsent');
        }

        // add key to wallet and try again
        try {
          this.setConnectState(
            this.t('connectWalletKeyService_text_stepAddKey'),
          );

          await closeTabsByFilter(browser, closeTabFilter);
          await this.addPublicKeyToWallet(walletAddress, (openedTabId) => {
            tabId = openedTabId;
            cleanupListeners = highlightTabOnPopupOpen(browser, tabId);
          });

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
            (openedTabId) => {
              cleanupListeners();
              tabId = openedTabId;
              cleanupListeners = highlightTabOnPopupOpen(browser, tabId);
            },
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
      walletAddress,
      rateOfPay,
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
        intent,
        (openedTabId) => {
          tabId = openedTabId;
        },
      );
    } catch (error) {
      if (isAbortSignalTimeout(error)) {
        await this.redirectOnTimeout(intent, tabId);
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
    let tabId: TabId | undefined;
    try {
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        walletAmount,
        walletAddress,
        grant,
        intent,
        (openedTabId) => {
          tabId = openedTabId;
        },
      );
    } catch (error) {
      if (isAbortSignalTimeout(error)) {
        await this.redirectOnTimeout(intent, tabId);
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
   */
  private async addPublicKeyToWallet(
    walletAddress: WalletInfo,
    onTabOpen: (tabId: TabId) => void,
  ) {
    const keyAutoAdd = new KeyAutoAddService({
      browser: this.browser,
      storage: this.storage,
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
      if (error instanceof ErrorWithKey) {
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

  private async redirectOnTimeout(intent: InteractionIntent, tabId?: TabId) {
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
  return onPopupOpen(browser, async () => highlightTab(browser, tabId));
};
