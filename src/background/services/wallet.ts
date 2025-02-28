import {
  getWalletInformation,
  isErrorWithKey,
  ErrorWithKey,
  errorWithKeyToJSON,
  type ErrorWithKeyLike,
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
  ensureTabExists,
} from '@/background/utils';
import { KeyAutoAddService } from '@/background/services/keyAutoAdd';
import { generateEd25519KeyPair, exportJWK } from '@/shared/crypto';
import { isInvalidClientError } from '@/background/services/openPayments';
import { APP_URL } from '@/background/constants';
import { bytesToHex } from '@noble/hashes/utils';
import type { Cradle } from '@/background/container';
import type { AmountValue, TabId } from '@/shared/types';
import type { WalletAddress } from '@interledger/open-payments';

export class WalletService {
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private storage: Cradle['storage'];
  private events: Cradle['events'];
  private browser: Cradle['browser'];
  private appName: Cradle['appName'];
  private browserName: Cradle['browserName'];
  private t: Cradle['t'];

  constructor({
    outgoingPaymentGrantService,
    openPaymentsService,
    storage,
    events,
    browser,
    appName,
    browserName,
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
    this.setConnectState('connecting');

    const [existingTab] = await this.browser.tabs.query({
      url: this.browser.runtime.getURL(APP_URL),
    });
    try {
      await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
        amount,
        walletAddress,
        recurring,
        InteractionIntent.CONNECT,
        existingTab?.id,
      );
    } catch (error) {
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
          const tabId = await this.addPublicKeyToWallet(
            walletAddress,
            existingTab?.id,
          );
          this.setConnectState('connecting');
          await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
            amount,
            walletAddress,
            recurring,
            InteractionIntent.CONNECT,
            tabId,
          );
        } catch (error) {
          this.setConnectStateError(error);
          throw error;
        }
      } else {
        this.setConnectStateError(error);
        throw error;
      }
    }

    await this.storage.set({
      walletAddress,
      rateOfPay,
      minRateOfPay,
      maxRateOfPay,
      connected: true,
    });
    this.setConnectState(null);
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
    this.setConnectState('connecting');

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

    this.setConnectState(null);
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

    await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
      amount,
      walletAddress!,
      recurring,
      InteractionIntent.FUNDS,
    );

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

    await this.outgoingPaymentGrantService.completeOutgoingPaymentGrant(
      amount,
      walletAddress!,
      recurring,
      InteractionIntent.UPDATE_BUDGET,
    );

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
   * @returns tabId that we can reuse for further connecting, or redirects etc.
   */
  private async addPublicKeyToWallet(
    walletAddress: WalletAddress,
    tabId?: TabId,
  ): Promise<TabId | undefined> {
    const keyAutoAdd = new KeyAutoAddService({
      browser: this.browser,
      storage: this.storage,
      appName: this.appName,
      browserName: this.browserName,
      t: this.t,
    });
    this.events.emit('request_popup_close');
    try {
      await keyAutoAdd.addPublicKeyToWallet(walletAddress, tabId);
      return keyAutoAdd.tabId;
    } catch (error) {
      const tabId = keyAutoAdd.tabId;
      const isTabClosed = error.key === 'connectWallet_error_tabClosed';
      const isTabNavAway = error.key === 'connectWallet_error_tabNavigatedAway';
      if (tabId && (!isTabClosed || isTabNavAway)) {
        await redirectToWelcomeScreen(
          this.browser,
          tabId,
          GrantResult.GRANT_ERROR,
          InteractionIntent.CONNECT,
          ErrorCode.KEY_ADD_FAILED,
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

  private async retryAddPublicKeyToWallet(walletAddress: WalletAddress) {
    let tabId: number | undefined;

    try {
      tabId = await this.addPublicKeyToWallet(walletAddress);
      await this.outgoingPaymentGrantService.rotateToken();

      tabId ??= await ensureTabExists(this.browser);
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

  public resetConnectState() {
    this.setConnectState(null);
  }

  private setConnectState(status: 'connecting' | null) {
    const state = status ? { status } : null;
    this.storage.setPopupTransientState('connect', () => state);
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
