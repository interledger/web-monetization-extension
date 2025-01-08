import {
  getWalletInformation,
  isErrorWithKey,
  ErrorWithKey,
  ErrorWithKeyLike,
  errorWithKeyToJSON,
} from '@/shared/helpers';
import {
  AddFundsPayload,
  ConnectWalletPayload,
  ReconnectWalletPayload,
  UpdateBudgetPayload,
} from '@/shared/messages';
import {
  DEFAULT_RATE_OF_PAY,
  MIN_RATE_OF_PAY,
  MAX_RATE_OF_PAY,
} from '../config';
import { APP_URL } from '../constants';
import { Cradle } from '../container';
import { getExchangeRates, getRateOfPay as _getRateOfPay } from '../utils';
import { KeyAutoAddService } from './keyAutoAdd';
import { InteractionIntent } from './outgoingPaymentGrant';
import { generateEd25519KeyPair, exportJWK } from '@/shared/crypto';
import { bytesToHex } from '@noble/hashes/utils';
import { isInvalidClientError } from './openPayments';

export class WalletService {
  private storage: Cradle['storage'];
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private browser: Cradle['browser'];
  private t: Cradle['t'];

  constructor({
    storage,
    outgoingPaymentGrantService,
    openPaymentsService,
    browser,
    t,
  }: Cradle) {
    Object.assign(this, {
      storage,
      outgoingPaymentGrantService,
      openPaymentsService,
      browser,
      t,
    });
  }

  async connectWallet(params: ConnectWalletPayload | null) {
    if (!params) {
      this.setConnectState(null);
      return;
    }
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

    if (!exchangeRates.rates[walletAddress.assetCode]) {
      throw new Error(
        `Exchange rate for ${walletAddress.assetCode} not found.`,
      );
    }

    const exchangeRate = exchangeRates.rates[walletAddress.assetCode];
    const getRateOfPay = (rate: string) =>
      _getRateOfPay({
        rate,
        exchangeRate,
        assetScale: walletAddress.assetScale,
      });
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
          const tabId =
            await this.outgoingPaymentGrantService.addPublicKeyToWallet(
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

    try {
      this.setConnectState('connecting');
      await this.validateReconnect();
    } catch (error) {
      if (!isInvalidClientError(error?.cause)) {
        this.setConnectStateError(error);
        throw error;
      }

      try {
        // add key to wallet and try again
        this.outgoingPaymentGrantService.retryAddPublicKeyToWallet(
          walletAddress,
        );
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

    await this.storage.setState({ out_of_funds: false });
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
      await this.outgoingPaymentGrantService.cancelGrant(
        existingGrants.oneTimeGrant.continue,
      );
      if (recurring) {
        this.storage.set({
          oneTimeGrant: null,
          oneTimeGrantSpentAmount: '0',
        });
      }
    }
    if (existingGrants.recurringGrant) {
      await this.outgoingPaymentGrantService.cancelGrant(
        existingGrants.recurringGrant.continue,
      );
      if (!recurring) {
        this.storage.set({
          recurringGrant: null,
          recurringGrantSpentAmount: '0',
        });
      }
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
