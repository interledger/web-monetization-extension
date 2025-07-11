import {
  isPendingGrant,
  OpenPaymentsClientError,
  type IncomingPayment,
  type OutgoingPaymentWithSpentAmounts as OutgoingPayment,
  type WalletAddress,
} from '@interledger/open-payments';
import { ErrorWithKey, sleep, transformBalance } from '@/shared/helpers';
import {
  isInternalServerError,
  isInvalidReceiverError,
  isKeyRevokedError,
  isMissingGrantPermissionsError,
  isNonPositiveAmountError,
  isOutOfBalanceError,
  isTokenExpiredError,
} from '@/background/services/openPayments';
import {
  bigIntMax,
  convert,
  convertWithExchangeRate,
  getExchangeRates,
  getNextSendableAmount,
} from '@/background/utils';
import type {
  MonetizationEventDetails,
  MonetizationEventPayload,
} from '@/shared/messages';
import type { AmountValue } from '@/shared/types';
import type { Cradle as Cradle_ } from '@/background/container';
import {
  OUTGOING_PAYMENT_POLLING_INITIAL_DELAY,
  OUTGOING_PAYMENT_POLLING_INTERVAL,
} from '@/background/config';

const MIN_SEND_AMOUNT = 1n; // 1 unit
const MAX_INVALID_RECEIVER_ATTEMPTS = 2;

type IncomingPaymentSource = 'one-time' | 'continuous';
interface CreateOutgoingPaymentParams {
  walletAddress: WalletAddress;
  incomingPaymentId: IncomingPayment['id'];
  amount: AmountValue;
}
type Cradle = Pick<
  Cradle_,
  | 'storage'
  | 'openPaymentsService'
  | 'outgoingPaymentGrantService'
  | 'events'
  | 'tabState'
  | 'logger'
  | 'message'
>;

export class PaymentSession {
  private storage: Cradle['storage'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private events: Cradle['events'];
  private tabState: Cradle['tabState'];
  private logger: Cradle['logger'];
  private message: Cradle['message'];

  /** Invalid receiver (providers not peered or other reasons) */
  private isInvalid = false;
  private countInvalidReceiver = 0;
  private isDisabled = false;
  private isStopped = false;
  private incomingPaymentUrl: string;
  private incomingPaymentExpiresAt: number;

  constructor(
    public readonly receiver: WalletAddress,
    public readonly id: string,
    public readonly tabId: number,
    public readonly frameId: number,
    public readonly tabUrl: string,
    private sender: WalletAddress,
    private deps: Cradle,
  ) {
    Object.assign(this, this.deps);
  }

  // We keep setting #minSendAmount to non-zero values as we probe. Instead of
  // checking #minSendAmount > 0, use this boolean to know if probing completed.
  #minSendAmountFound = false;
  #minSendAmount = 0n;
  #minSendAmountPromise: ReturnType<typeof this._findMinSendAmount>;

  findMinSendAmount(): Promise<void> {
    this.#minSendAmountPromise ??= this._findMinSendAmount();
    return this.#minSendAmountPromise;
  }

  get minSendAmount(): bigint {
    if (!this.#minSendAmountFound) {
      throw new Error('minSendAmount not figured out yet');
    }
    return this.#minSendAmount;
  }

  private async _findMinSendAmount(signal?: AbortSignal): Promise<void> {
    let amountToSend = bigIntMax(this.#minSendAmount, MIN_SEND_AMOUNT);
    const senderAssetScale = this.sender.assetScale;
    const receiverAssetScale = this.receiver.assetScale;
    const isCrossCurrency = this.sender.assetCode !== this.receiver.assetCode;

    if (!isCrossCurrency) {
      // If the sender can facilitate the rate, but the amount can not be
      // represented in the receiver's scale we need to send the minimum amount
      // for the receiver (1 unit, but in the sender's asset scale)
      if (senderAssetScale > receiverAssetScale) {
        const amountInReceiversScale = convert(
          amountToSend,
          senderAssetScale,
          receiverAssetScale,
        );

        if (amountInReceiversScale === 0n) {
          amountToSend = convert(
            MIN_SEND_AMOUNT,
            receiverAssetScale,
            senderAssetScale,
          );
        }
      }
    }

    if (isCrossCurrency) {
      try {
        const exchangeRates = await getExchangeRates();
        amountToSend = convertWithExchangeRate(
          amountToSend,
          this.receiver,
          this.sender,
          exchangeRates,
        );
        this.logger.debug('minSendAmount: via exchangeRate', amountToSend);
      } catch {}
    }

    // This all will eventually get replaced by OpenPayments response update
    // that includes a min rate that we can directly use.
    await this.setIncomingPaymentUrl();
    const amountIter = getNextSendableAmount(
      senderAssetScale,
      receiverAssetScale,
      bigIntMax(amountToSend, MIN_SEND_AMOUNT),
    );

    amountToSend = BigInt(amountIter.next().value);
    let prevAmountToSend = amountToSend;
    while (true) {
      signal?.throwIfAborted();
      this.#minSendAmount = amountToSend;
      try {
        await this.createPaymentQuote(
          amountToSend.toString(),
          this.incomingPaymentUrl,
          this.sender,
        );
        break;
      } catch (e) {
        if (isTokenExpiredError(e)) {
          await this.outgoingPaymentGrantService.rotateToken();
        } else if (isNonPositiveAmountError(e)) {
          prevAmountToSend = amountToSend;
          amountToSend = BigInt(amountIter.next().value);
        } else if (isInvalidReceiverError(e) || isInternalServerError(e)) {
          // Treat InternalServerError same as invalid receiver due to
          // https://github.com/interledger/rafiki/issues/3093
          //
          // It is also sensible to mark the session invalid in case server is
          // having issues.
          this.markInvalid();
          this.events.emit('open_payments.invalid_receiver', {
            tabId: this.tabId,
          });
          break;
        } else {
          throw e;
        }
      }
    }

    if (prevAmountToSend === amountToSend) {
      this.#minSendAmountFound = true;
      return;
    }

    // Once we've found a sendable amount with exponential probing above, ensure
    // it's the minimum.
    let left = prevAmountToSend;
    let right = amountToSend;
    while (left < right && !this.#minSendAmountFound) {
      signal?.throwIfAborted();
      const mid = (left + right) / 2n;
      try {
        // this.logger.log('minSendAmount: binary search', { left, right, mid });
        await this.createPaymentQuote(
          mid.toString(),
          this.incomingPaymentUrl,
          this.sender,
        );
        this.#minSendAmount = mid;
        right = mid - 1n;
      } catch (e) {
        if (isTokenExpiredError(e)) {
          await this.outgoingPaymentGrantService.rotateToken();
        } else if (isNonPositiveAmountError(e)) {
          left = mid + 1n;
        } else {
          // it won't be invalidReceiver or any other now, so just throw
          throw e;
        }
      }
    }
    this.#minSendAmountFound = true;
    // this.logger.log('minSendAmount: binary search gave us', this.minSendAmount);
  }

  get disabled() {
    return this.isDisabled;
  }

  get invalid() {
    return this.isInvalid;
  }

  get active() {
    return !this.isStopped;
  }

  get isUsable() {
    try {
      void this.minSendAmount;
    } catch {
      return false;
    }
    return !this.invalid && !this.disabled;
  }

  disable() {
    this.isDisabled = true;
  }

  enable() {
    this.isDisabled = false;
  }

  activate() {
    this.isStopped = false;
  }

  deactivate() {
    this.isStopped = true;
  }

  private markInvalid() {
    this.isInvalid = true;
  }

  async sendMonetizationEvent(payload: MonetizationEventPayload['details']) {
    await this.message.sendToTab(
      this.tabId,
      this.frameId,
      'MONETIZATION_EVENT',
      { requestId: this.id, details: payload },
    );
  }

  private async setIncomingPaymentUrl(reset?: boolean) {
    if (this.incomingPaymentUrl && !reset) return;

    try {
      const incomingPayment = await this.createIncomingPayment('continuous');
      this.incomingPaymentUrl = incomingPayment.id;
    } catch (error) {
      if (isKeyRevokedError(error)) {
        this.events.emit('open_payments.key_revoked');
        return;
      }
      throw error;
    }
  }

  private async createIncomingPayment(
    source: IncomingPaymentSource,
  ): Promise<IncomingPayment> {
    const expiresAt = new Date(
      Date.now() + 1000 * (source === 'continuous' ? 60 * 10 : 30),
    ).toISOString();

    const incomingPaymentGrant =
      await this.openPaymentsService.client.grant.request(
        {
          url: this.receiver.authServer,
        },
        {
          access_token: {
            access: [
              {
                type: 'incoming-payment',
                actions: ['create'],
                identifier: this.receiver.id,
              },
            ],
          },
        },
      );

    if (isPendingGrant(incomingPaymentGrant)) {
      throw new Error(
        'Expected non-interactive grant. Received pending grant.',
      );
    }

    const incomingPayment =
      await this.openPaymentsService.client.incomingPayment.create(
        {
          url: this.receiver.resourceServer,
          accessToken: incomingPaymentGrant.access_token.value,
        },
        {
          walletAddress: this.receiver.id,
          expiresAt,
          metadata: {
            source: 'Web Monetization',
          },
        },
      );

    if (incomingPayment.expiresAt) {
      this.incomingPaymentExpiresAt = new Date(
        incomingPayment.expiresAt,
      ).valueOf();
    }

    // Revoke grant to avoid leaving users with unused, dangling grants.
    await this.openPaymentsService.client.grant.cancel({
      url: incomingPaymentGrant.continue.uri,
      accessToken: incomingPaymentGrant.continue.access_token.value,
    });

    return incomingPayment;
  }

  private async createOutgoingPayment({
    walletAddress,
    amount,
    incomingPaymentId,
  }: CreateOutgoingPaymentParams): Promise<OutgoingPayment> {
    const { client } = this.openPaymentsService;
    const outgoingPayment = await client.outgoingPayment.create(
      {
        accessToken: this.outgoingPaymentGrantService.accessToken,
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
    );

    if (outgoingPayment.grantSpentDebitAmount) {
      this.storage.updateSpentAmount(
        this.outgoingPaymentGrantService.grantType,
        outgoingPayment.grantSpentDebitAmount.value,
      );
    }
    await this.storage.setState({ out_of_funds: false });

    return outgoingPayment;
  }

  private async createPaymentQuote(
    amount: AmountValue,
    incomingPayment: IncomingPayment['id'],
    sender: WalletAddress,
  ): Promise<void> {
    await this.openPaymentsService.client.quote.create(
      {
        url: sender.resourceServer,
        accessToken: this.outgoingPaymentGrantService.accessToken,
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

  async payOneTime(amount: bigint): Promise<OutgoingPayment> {
    if (this.isDisabled) {
      throw new Error('Attempted to send a payment to a disabled session.');
    }

    const incomingPayment = await this.createIncomingPayment('one-time').catch(
      (error) => {
        if (isKeyRevokedError(error)) {
          this.events.emit('open_payments.key_revoked');
        }
        throw error;
      },
    );

    try {
      const outgoingPayment = await this.createOutgoingPayment({
        walletAddress: this.sender,
        incomingPaymentId: incomingPayment.id,
        amount: amount.toString(),
      });

      void this.sendMonetizationEvent({
        amountSent: {
          currency: outgoingPayment.receiveAmount.assetCode,
          value: transformBalance(
            outgoingPayment.receiveAmount.value,
            outgoingPayment.receiveAmount.assetScale,
          ),
        },
        incomingPayment: outgoingPayment.receiver,
        paymentPointer: this.receiver.id,
      });

      return outgoingPayment;
    } catch (e) {
      if (isKeyRevokedError(e)) {
        this.events.emit('open_payments.key_revoked');
        throw e;
      } else if (isTokenExpiredError(e)) {
        await this.outgoingPaymentGrantService.rotateToken();
        return await this.payOneTime(amount); // retry
      } else {
        throw e;
      }
    }
  }

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
        const { client } = this.openPaymentsService;
        const outgoingPayment = await client.outgoingPayment.get({
          url: outgoingPaymentId,
          accessToken: this.outgoingPaymentGrantService.accessToken,
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
          const token = await this.outgoingPaymentGrantService.rotateToken();
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

  /**
   * @returns `true` if payment made successfully, `false` if failed with a
   * retry-able error and `null` otherwise
   * @throws on unhandled errors
   */
  async pay(amount: bigint): Promise<boolean | null> {
    try {
      // this.logger.debug(`Paying ${amount} to ${this.receiver.id}`);
      const outgoingPayment = await this.createOutgoingPayment({
        walletAddress: this.sender,
        incomingPaymentId: this.incomingPaymentUrl,
        amount: amount.toString(),
      });
      const { receiveAmount, receiver: incomingPayment } = outgoingPayment;
      const monetizationEventDetails: MonetizationEventDetails = {
        amountSent: {
          currency: receiveAmount.assetCode,
          value: transformBalance(
            receiveAmount.value,
            receiveAmount.assetScale,
          ),
        },
        incomingPayment,
        paymentPointer: this.receiver.id,
      };

      void this.sendMonetizationEvent(monetizationEventDetails);

      this.tabState.saveLastPaymentDetails(this.tabId, this.tabUrl, {
        walletAddressId: this.receiver.id,
        monetizationEvent: monetizationEventDetails,
      });

      return true;
    } catch (e) {
      if (isKeyRevokedError(e)) {
        this.events.emit('open_payments.key_revoked');
        return null;
      } else if (isTokenExpiredError(e)) {
        await this.outgoingPaymentGrantService.rotateToken();
        return false;
      } else if (isOutOfBalanceError(e)) {
        const switched = await this.outgoingPaymentGrantService.switchGrant();
        if (switched === null) {
          this.events.emit('open_payments.out_of_funds');
          return null;
        } else {
          return false;
        }
      } else if (isInvalidReceiverError(e)) {
        if (Date.now() >= this.incomingPaymentExpiresAt) {
          await this.setIncomingPaymentUrl(true);
          return false;
        } else {
          ++this.countInvalidReceiver;
          if (
            this.countInvalidReceiver >= MAX_INVALID_RECEIVER_ATTEMPTS &&
            !this.isInvalid
          ) {
            this.markInvalid();
            this.events.emit('open_payments.invalid_receiver', {
              tabId: this.tabId,
            });
            return null;
          } else {
            return false;
          }
        }
      } else {
        throw e;
      }
    }
  }

  /**
   * Retry the continuos payment once on a retry-able error.
   * @throws never
   */
  async payWithRetry(amount: bigint) {
    let paid: boolean | null = false;
    try {
      paid = await this.pay(amount);
      if (paid === false) paid = await this.pay(amount);
    } catch (error) {
      this.logger.error(error);
    }
    return paid === true;
  }
}
