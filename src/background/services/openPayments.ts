// cSpell:ignore keyid
import type { AmountValue, TabId } from 'shared/types';
import {
  type AuthenticatedClient,
  createAuthenticatedClient,
  OpenPaymentsClientError,
} from '@interledger/open-payments/dist/client';
import {
  type IncomingPayment,
  type OutgoingPaymentWithSpentAmounts as OutgoingPayment,
  type WalletAddress,
} from '@interledger/open-payments/dist/types';
import * as ed from '@noble/ed25519';
import { type Request } from 'http-message-signatures';
import { signMessage } from 'http-message-signatures/lib/httpbis';
import { createContentDigestHeader } from 'httpbis-digest-headers';
import {
  redirectToWelcomeScreen,
  getExchangeRates,
  getRateOfPay,
} from '@/background/utils';
import { KeyAutoAddService } from './keyAutoAdd';
import { exportJWK, generateEd25519KeyPair } from '@/shared/crypto';
import { bytesToHex } from '@noble/hashes/utils';
import {
  ErrorWithKey,
  errorWithKeyToJSON,
  getWalletInformation,
  isErrorWithKey,
  sleep,
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
  MAX_RATE_OF_PAY,
  MIN_RATE_OF_PAY,
  OUTGOING_PAYMENT_POLLING_INTERVAL,
  OUTGOING_PAYMENT_POLLING_INITIAL_DELAY,
} from '../config';
import type { Cradle } from '@/background/container';
import { OutgoingPaymentGrantService } from './outgoingPaymentGrant';
import { ErrorCode, GrantResult, InteractionIntent } from '@/shared/enums';
import { APP_URL } from '@/background/constants';

interface KeyInformation {
  privateKey: string;
  keyId: string;
}

export interface SignatureHeaders {
  Signature: string;
  'Signature-Input': string;
}

interface ContentHeaders {
  'Content-Digest': string;
  'Content-Length': string;
  'Content-Type': string;
}
type Headers = SignatureHeaders & Partial<ContentHeaders>;

interface RequestLike extends Request {
  body?: string;
}

interface SignOptions {
  request: RequestLike;
  privateKey: Uint8Array;
  keyId: string;
}

interface CreateOutgoingPaymentParams {
  walletAddress: WalletAddress;
  incomingPaymentId: IncomingPayment['id'];
  amount: string;
}

export class OpenPaymentsService {
  private browser: Cradle['browser'];
  private storage: Cradle['storage'];
  private grantService: Cradle['grantService'];
  private appName: Cradle['appName'];
  private browserName: Cradle['browserName'];
  private t: Cradle['t'];

  constructor({
    browser,
    storage,
    grantService,
    appName,
    browserName,
    t,
  }: Cradle) {
    Object.assign(this, {
      browser,
      storage,
      grantService,
      appName,
      browserName,
      t,
    });

    void this.initialize();
  }

  public client?: AuthenticatedClient;

  public switchGrant(): OutgoingPaymentGrantService['switchGrant'] {
    return this.grantService.switchGrant;
  }

  public isAnyGrantUsable() {
    return this.grantService.isAnyGrantUsable();
  }

  public async rotateToken() {
    return this.grantService.rotateToken(this.client!);
  }

  private async initialize() {
    const { connected, walletAddress, oneTimeGrant, recurringGrant } =
      await this.storage.get([
        'connected',
        'walletAddress',
        'oneTimeGrant',
        'recurringGrant',
      ]);

    if (
      connected === true &&
      walletAddress &&
      (recurringGrant || oneTimeGrant)
    ) {
      await this.initClient(walletAddress.id);
    }
  }

  private async getPrivateKeyInformation(): Promise<KeyInformation> {
    const data = await this.browser.storage.local.get(['privateKey', 'keyId']);

    if (data.privateKey && data.keyId) {
      return data as unknown as KeyInformation;
    }

    throw new Error(
      'Could not create OpenPayments client. Missing `privateKey` and `keyId`.',
    );
  }

  private createContentHeaders(body: string): ContentHeaders {
    return {
      'Content-Digest': createContentDigestHeader(
        JSON.stringify(JSON.parse(body)),
        ['sha-512'],
      ),
      'Content-Length': new TextEncoder().encode(body).length.toString(),
      'Content-Type': 'application/json',
    };
  }

  private createSigner(key: Uint8Array, keyId: string) {
    return {
      id: keyId,
      alg: 'ed25519',
      async sign(data: Uint8Array) {
        return Buffer.from(await ed.signAsync(data, key.slice(16)));
      },
    };
  }

  private async createSignatureHeaders({
    request,
    privateKey,
    keyId,
  }: SignOptions): Promise<SignatureHeaders> {
    const components = ['@method', '@target-uri'];
    if (request.headers['Authorization'] || request.headers['authorization']) {
      components.push('authorization');
    }

    if (request.body) {
      components.push('content-digest', 'content-length', 'content-type');
    }

    const signingKey = this.createSigner(privateKey, keyId);
    const { headers } = await signMessage(
      {
        name: 'sig1',
        params: ['keyid', 'created'],
        fields: components,
        key: signingKey,
      },
      {
        url: request.url,
        method: request.method,
        headers: request.headers,
      },
    );

    return {
      Signature: headers['Signature'] as string,
      'Signature-Input': headers['Signature-Input'] as string,
    };
  }

  private async createHeaders({
    request,
    privateKey,
    keyId,
  }: SignOptions): Promise<Headers> {
    if (request.body) {
      const contentHeaders = this.createContentHeaders(request.body);
      request.headers = { ...request.headers, ...contentHeaders };
    }

    const signatureHeaders = await this.createSignatureHeaders({
      request,
      privateKey,
      keyId,
    });

    return {
      ...request.headers,
      ...signatureHeaders,
    };
  }

  async initClient(walletAddressUrl: string) {
    const { privateKey, keyId } = await this.getPrivateKeyInformation();

    this.client = await createAuthenticatedClient({
      validateResponses: false,
      requestTimeoutMs: 10000,
      walletAddressUrl,
      authenticatedRequestInterceptor: async (request) => {
        if (!request.method || !request.url) {
          throw new Error('Cannot intercept request: url or method missing');
        }

        const initialRequest = request.clone();

        const headers = await this.createHeaders({
          request: {
            method: request.method,
            url: request.url,
            headers: JSON.parse(
              JSON.stringify(Object.fromEntries(request.headers)),
            ),
            body: request.body
              ? JSON.stringify(await request.json())
              : undefined,
          },
          privateKey: ed.etc.hexToBytes(privateKey),
          keyId,
        });

        if (request.body) {
          initialRequest.headers.set(
            'Content-Type',
            headers['Content-Type'] as string,
          );
          initialRequest.headers.set(
            'Content-Digest',
            headers['Content-Digest'] as string,
          );
        }

        initialRequest.headers.set('Signature', headers['Signature']);
        initialRequest.headers.set(
          'Signature-Input',
          headers['Signature-Input'],
        );

        return initialRequest;
      },
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
    rateOfPay = getRateOfPay({
      rate: DEFAULT_RATE_OF_PAY,
      exchangeRate,
      assetScale: walletAddress.assetScale,
    });
    minRateOfPay = getRateOfPay({
      rate: MIN_RATE_OF_PAY,
      exchangeRate,
      assetScale: walletAddress.assetScale,
    });
    maxRateOfPay = getRateOfPay({
      rate: MAX_RATE_OF_PAY,
      exchangeRate,
      assetScale: walletAddress.assetScale,
    });

    await this.initClient(walletAddress.id);
    this.setConnectState('connecting');
    const [existingTab] = await this.browser.tabs.query({
      url: this.browser.runtime.getURL(APP_URL),
    });
    try {
      await this.grantService.createGrant(
        this.client!,
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
          this.updateConnectStateError(error);
          throw new ErrorWithKey(
            'connectWalletKeyService_error_notImplemented',
          );
        }
        if (!autoKeyAddConsent) {
          this.updateConnectStateError(error);
          throw new ErrorWithKey('connectWalletKeyService_error_noConsent');
        }

        // add key to wallet and try again
        try {
          const tabId = await this.addPublicKeyToWallet(
            walletAddress,
            existingTab?.id,
          );
          this.setConnectState('connecting');
          await this.grantService.createGrant(
            this.client!,
            amount,
            walletAddress,
            recurring,
            InteractionIntent.CONNECT,
            tabId,
          );
        } catch (error) {
          this.updateConnectStateError(error);
          throw error;
        }
      } else {
        this.updateConnectStateError(error);
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

  async addFunds({ amount, recurring }: AddFundsPayload) {
    const { walletAddress, ...grants } = await this.storage.get([
      'walletAddress',
      'oneTimeGrant',
      'recurringGrant',
    ]);

    await this.grantService.createGrant(
      this.client!,
      amount,
      walletAddress!,
      recurring,
      InteractionIntent.FUNDS,
    );

    // cancel existing grants of same type, if any
    if (grants.oneTimeGrant && !recurring) {
      await this.grantService.cancelGrant(
        grants.oneTimeGrant.continue,
        this.client!,
      );
    } else if (grants.recurringGrant && recurring) {
      await this.grantService.cancelGrant(
        grants.recurringGrant.continue,
        this.client!,
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

    await this.grantService.createGrant(
      this.client!,
      amount,
      walletAddress!,
      recurring,
      InteractionIntent.UPDATE_BUDGET,
    );

    // Revoke all existing grants.
    // Note: Clear storage only if new grant type is not same as previous grant
    // type (as completeGrant already sets new grant state)
    if (existingGrants.oneTimeGrant) {
      await this.grantService.cancelGrant(
        existingGrants.oneTimeGrant.continue,
        this.client!,
      );
      if (recurring) {
        this.storage.set({
          oneTimeGrant: null,
          oneTimeGrantSpentAmount: '0',
        });
      }
    }
    if (existingGrants.recurringGrant) {
      await this.grantService.cancelGrant(
        existingGrants.recurringGrant.continue,
        this.client!,
      );
      if (!recurring) {
        this.storage.set({
          recurringGrant: null,
          recurringGrantSpentAmount: '0',
        });
      }
    }
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
    try {
      await keyAutoAdd.addPublicKeyToWallet(walletAddress, tabId);
      return keyAutoAdd.tabId;
    } catch (error) {
      const tabId = keyAutoAdd.tabId;
      const isTabClosed = error.key === 'connectWallet_error_tabClosed';
      if (tabId && !isTabClosed) {
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

  private setConnectState(status: 'connecting' | null) {
    const state = status ? { status } : null;
    this.storage.setPopupTransientState('connect', () => state);
  }
  private updateConnectStateError(err: ErrorWithKeyLike | { message: string }) {
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

  async disconnectWallet() {
    const { recurringGrant, oneTimeGrant } = await this.storage.get([
      'recurringGrant',
      'oneTimeGrant',
    ]);
    if (!recurringGrant && !oneTimeGrant) {
      return;
    }
    if (recurringGrant) {
      await this.grantService.cancelGrant(
        recurringGrant.continue,
        this.client!,
      );
      this.grantService.disableRecurringGrant();
    }
    if (oneTimeGrant) {
      await this.grantService.cancelGrant(oneTimeGrant.continue, this.client!);
      this.grantService.disableOneTimeGrant();
    }
    await this.storage.clear();
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

  async createOutgoingPayment({
    walletAddress,
    amount,
    incomingPaymentId,
  }: CreateOutgoingPaymentParams): Promise<OutgoingPayment> {
    const outgoingPayment = (await this.client!.outgoingPayment.create(
      {
        accessToken: this.grantService.accessToken(),
        url: walletAddress.resourceServer,
      },
      {
        incomingPayment: incomingPaymentId,
        walletAddress: walletAddress.id,
        debitAmount: {
          value: amount,
          assetCode: walletAddress.assetCode,
          assetScale: walletAddress.assetScale,
        },
        metadata: {
          source: 'Web Monetization',
        },
      },
    )) as OutgoingPayment;

    if (outgoingPayment.grantSpentDebitAmount) {
      this.storage.updateSpentAmount(
        this.grantService.grantType(),
        outgoingPayment.grantSpentDebitAmount.value,
      );
    }
    await this.storage.setState({ out_of_funds: false });

    return outgoingPayment;
  }

  /** Polls for the completion of an outgoing payment */
  async *pollOutgoingPayment(
    outgoingPaymentId: OutgoingPayment['id'],
    {
      signal,
      maxAttempts = 10,
    }: Partial<{ signal: AbortSignal; maxAttempts: number }> = {},
  ): AsyncGenerator<OutgoingPayment, OutgoingPayment, void> {
    let attempt = 0;
    await sleep(OUTGOING_PAYMENT_POLLING_INITIAL_DELAY);
    while (++attempt <= maxAttempts) {
      try {
        signal?.throwIfAborted();
        const outgoingPayment = await this.client!.outgoingPayment.get({
          url: outgoingPaymentId,
          accessToken: this.grantService.accessToken(),
        });
        yield outgoingPayment;
        if (
          outgoingPayment.failed &&
          outgoingPayment.sentAmount.value === '0'
        ) {
          throw new ErrorWithKey('pay_error_outgoingPaymentFailed');
        }
        if (
          outgoingPayment.debitAmount.value === outgoingPayment.sentAmount.value
        ) {
          return outgoingPayment; // completed
        }
        signal?.throwIfAborted();
        await sleep(OUTGOING_PAYMENT_POLLING_INTERVAL);
      } catch (error) {
        if (
          isTokenExpiredError(error) ||
          isMissingGrantPermissionsError(error)
        ) {
          // TODO: We can remove the token `actions` check once we've proper RS
          // errors in place. Then we can handle insufficient grant error
          // separately clearly.
          const token = await this.grantService.rotateToken(this.client!);
          const hasReadAccess = token.access_token.access.find(
            (e) => e.type === 'outgoing-payment' && e.actions.includes('read'),
          );
          if (!hasReadAccess) {
            throw new OpenPaymentsClientError('InsufficientGrant', {
              description: error.description,
            });
          }
        } else {
          throw error;
        }
      }
    }

    throw new ErrorWithKey('pay_warn_outgoingPaymentPollingIncomplete');
  }

  async probeDebitAmount(
    amount: AmountValue,
    incomingPayment: IncomingPayment['id'],
    sender: WalletAddress,
  ): Promise<void> {
    await this.client!.quote.create(
      {
        url: sender.resourceServer,
        accessToken: this.grantService.accessToken(),
      },
      {
        method: 'ilp',
        receiver: incomingPayment,
        walletAddress: sender.id,
        debitAmount: {
          value: amount,
          assetCode: sender.assetCode,
          assetScale: sender.assetScale,
        },
      },
    );
  }

  private async validateReconnect() {
    try {
      await this.grantService.rotateToken(this.client!);
    } catch (error) {
      if (isInvalidClientError(error)) {
        const msg = this.t('connectWallet_error_invalidClient');
        throw new Error(msg, { cause: error });
      }
      throw error;
    }
    await this.storage.setState({ key_revoked: false });
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
        this.updateConnectStateError(error);
        throw error;
      }

      let tabId: number | undefined;
      try {
        // add key to wallet and try again
        tabId = await this.addPublicKeyToWallet(walletAddress);
        await this.validateReconnect();

        tabId ??= await this.ensureTabExists();
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
        this.updateConnectStateError(error);
        throw error;
      }
    }

    this.setConnectState(null);
  }

  private async ensureTabExists(): Promise<number> {
    const tab = await this.browser.tabs.create({});
    if (!tab.id) {
      throw new Error('Could not create tab');
    }
    return tab.id;
  }
}

const isOpenPaymentsClientError = (error: any) =>
  error instanceof OpenPaymentsClientError;

export const isKeyRevokedError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return isInvalidClientError(error) || isSignatureValidationError(error);
};

// AUTH SERVER error
export const isInvalidClientError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 400 && error.code === 'invalid_client';
};

export const isInvalidContinuationError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 401 && error.code === 'invalid_continuation';
};

// RESOURCE SERVER error. Create outgoing payment and create quote can fail
// with: `Signature validation error: could not find key in list of client keys`
export const isSignatureValidationError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return (
    error.status === 401 &&
    error.description?.includes('Signature validation error')
  );
};

export const isTokenExpiredError = (
  error: any,
): error is OpenPaymentsClientError => {
  if (!isOpenPaymentsClientError(error)) return false;
  return isTokenInvalidError(error) || isTokenInactiveError(error);
};
export const isTokenInvalidError = (error: OpenPaymentsClientError) => {
  return error.status === 401 && error.description === 'Invalid Token';
};
export const isTokenInactiveError = (error: OpenPaymentsClientError) => {
  return error.status === 403 && error.description === 'Inactive Token';
};

// happens during quoting only
export const isNonPositiveAmountError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return (
    error.status === 400 &&
    error.description?.toLowerCase()?.includes('non-positive receive amount')
  );
};

export const isOutOfBalanceError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 403 && error.description === 'unauthorized';
};

export const isMissingGrantPermissionsError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  // providers using Rafiki <= v1.0.0-alpha.15 show "Insufficient Grant" error,
  // but Rafiki >= v1.0.0-alpha.16 shows "Inactive Token" (due to
  // https://github.com/interledger/rafiki/pull/2788)
  return (
    error.status === 403 &&
    (error.description === 'Insufficient Grant' || isTokenInactiveError(error))
  );
};

export const isInvalidReceiverError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 400 && error.description === 'invalid receiver';
};

export const isNotFoundError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 404;
};
