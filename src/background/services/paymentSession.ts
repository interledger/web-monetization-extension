import {
  isPendingGrant,
  OpenPaymentsClientError,
  type IncomingPayment,
  type OutgoingPaymentWithSpentAmounts as OutgoingPayment,
  type WalletAddress,
} from '@interledger/open-payments';
import {
  bigIntMax,
  convert,
  ErrorWithKey,
  sleep,
  transformBalance,
} from '@/shared/helpers';
import {
  isInternalServerError,
  isInvalidReceiverError,
  isKeyRevokedError,
  isMissingGrantPermissionsError,
  isNonPositiveAmountError,
  isOutOfBalanceError,
  isTokenExpiredError,
} from '@/background/services/openPayments';
import { getNextSendableAmount } from '@/background/utils';
import type {
  EventsService,
  OpenPaymentsService,
  OutgoingPaymentGrantService,
  StorageService,
  TabState,
} from '.';
import type {
  BackgroundToContentMessage,
  MessageManager,
  MonetizationEventDetails,
  MonetizationEventPayload,
} from '@/shared/messages';
import type { AmountValue } from '@/shared/types';
import type { Logger } from '@/shared/logger';
import {
  OUTGOING_PAYMENT_POLLING_INITIAL_DELAY,
  OUTGOING_PAYMENT_POLLING_INTERVAL,
} from '@/background/config';

const HOUR_MS = 3600 * 1000;
const MIN_SEND_AMOUNT = 1n; // 1 unit
const MAX_INVALID_RECEIVER_ATTEMPTS = 2;

type PaymentSessionSource = 'tab-change' | 'request-id-reused' | 'new-link';
type IncomingPaymentSource = 'one-time' | 'continuous';
interface CreateOutgoingPaymentParams {
  walletAddress: WalletAddress;
  incomingPaymentId: IncomingPayment['id'];
  amount: string;
}

export class PaymentSession {
  private rate: string;
  private active = false;
  /** Invalid receiver (providers not peered or other reasons) */
  private isInvalid = false;
  private countInvalidReceiver = 0;
  private isDisabled = false;
  private incomingPaymentUrl: string;
  private incomingPaymentExpiresAt: number;
  private amount: string;
  private intervalInMs: number;
  private shouldRetryImmediately = false;

  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private receiver: WalletAddress,
    private sender: WalletAddress,
    private requestId: string,
    private tabId: number,
    private frameId: number,
    private storage: StorageService,
    private openPaymentsService: OpenPaymentsService,
    private outgoingPaymentGrantService: OutgoingPaymentGrantService,
    private events: EventsService,
    private tabState: TabState,
    private url: string,
    private logger: Logger,
    private message: MessageManager<BackgroundToContentMessage>,
  ) {}

  #adjustAmountLastRate: AmountValue;
  #adjustAmountController = new AbortController();
  #adjustAmountPromise: null | Promise<void> = null;
  adjustAmount(rate: AmountValue): Promise<void> {
    if (this.#adjustAmountLastRate && rate !== this.#adjustAmountLastRate) {
      this.#adjustAmountController.abort(
        new DOMException(
          `Aborting existing probing for rate=${this.#adjustAmountLastRate}`,
          'AbortError',
        ),
      );
      this.#adjustAmountController = new AbortController();
      this.#adjustAmountPromise = null;
    }

    this.#adjustAmountLastRate = rate;
    this.#adjustAmountPromise ??= this._adjustAmount(
      rate,
      this.#adjustAmountController.signal,
    );

    return this.#adjustAmountPromise;
  }

  private async _adjustAmount(
    rate: AmountValue,
    signal: AbortSignal,
  ): Promise<void> {
    this.rate = rate;

    // The amount that needs to be sent every second.
    // In senders asset scale already.
    let amountToSend = BigInt(this.rate) / 3600n;
    const senderAssetScale = this.sender.assetScale;
    const receiverAssetScale = this.receiver.assetScale;
    const isCrossCurrency = this.sender.assetCode !== this.receiver.assetCode;

    if (!isCrossCurrency) {
      if (amountToSend <= MIN_SEND_AMOUNT) {
        // We need to add another unit when using a debit amount, since
        // @interledger/pay subtracts one unit.
        if (senderAssetScale <= receiverAssetScale) {
          amountToSend = MIN_SEND_AMOUNT + 1n;
        } else if (senderAssetScale > receiverAssetScale) {
          // If the sender scale is greater than the receiver scale, the unit
          // issue will not be present.
          amountToSend = MIN_SEND_AMOUNT;
        }
      }

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

    // This all will eventually get replaced by OpenPayments response update
    // that includes a min rate that we can directly use.
    await this.setIncomingPaymentUrl();
    const amountIter = getNextSendableAmount(
      senderAssetScale,
      receiverAssetScale,
      bigIntMax(amountToSend, MIN_SEND_AMOUNT),
    );

    amountToSend = BigInt(amountIter.next().value);
    while (true) {
      signal.throwIfAborted();
      try {
        await this.createPaymentQuote(
          amountToSend.toString(),
          this.incomingPaymentUrl,
          this.sender,
        );
        this.setAmount(amountToSend);
        break;
      } catch (e) {
        if (isTokenExpiredError(e)) {
          await this.outgoingPaymentGrantService.rotateToken();
        } else if (isNonPositiveAmountError(e)) {
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
  }

  get id() {
    return this.requestId;
  }

  get disabled() {
    return this.isDisabled;
  }

  get invalid() {
    return this.isInvalid;
  }

  disable() {
    this.isDisabled = true;
    this.stop();
  }

  /**
   * there's no enable() as we replace the sessions with new ones when
   * resume/start or removal of disabled attribute at the moment.
   * @deprecated
   */
  enable() {
    throw new Error('Method not implemented.');
  }

  private markInvalid() {
    this.isInvalid = true;
    this.stop();
  }

  stop() {
    this.active = false;
    this.clearTimers();
  }

  resume() {
    this.start('tab-change');
  }

  private clearTimers() {
    if (this.timeout) {
      this.debug(`Clearing timeout=${this.timeout}`);
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private debug(message: string) {
    this.logger.debug(
      `[PAYMENT SESSION] requestId=${this.requestId}; receiver=${this.receiver.id}\n\n`,
      `   ${message}`,
    );
  }

  async start(source: PaymentSessionSource) {
    this.debug(
      `Attempting to start; source=${source} active=${this.active} disabled=${this.isDisabled} isInvalid=${this.isInvalid}`,
    );
    if (this.active || this.isDisabled || this.isInvalid) return;
    this.debug(`Session started; source=${source}`);
    this.active = true;

    await this.setIncomingPaymentUrl();

    const { waitTime, monetizationEvent } = this.tabState.getOverpayingDetails(
      this.tabId,
      this.url,
      this.receiver.id,
    );

    this.debug(`Overpaying: waitTime=${waitTime}`);

    if (monetizationEvent && source !== 'tab-change') {
      this.sendMonetizationEvent({
        requestId: this.requestId,
        details: monetizationEvent,
      });
    }

    const continuePayment = () => {
      if (!this.canContinuePayment) return;
      void this.payContinuous().catch((err) => {
        this.logger.error('Error while making continuous payment', err);
      });
      // This recursive call in setTimeout is essentially setInterval here,
      // except we can have a dynamic interval (immediate vs intervalInMs).
      this.timeout = setTimeout(
        continuePayment,
        this.shouldRetryImmediately ? 0 : this.intervalInMs,
      );
    };

    if (!this.rate) {
      // this.rate is set when adjustAmount begins. this.amount is set only after first successful adjustAmount
      throw new Error('Unexpected: adjustAmount not yet ready');
    }
    if (this.canContinuePayment) {
      this.timeout = setTimeout(async () => {
        if (!this.amount) {
          await this.adjustAmount(this.rate);
        }
        if (!this.amount) {
          // if still not set, fail
          throw new Error('amount not set for continuous payments');
        }

        await this.payContinuous();
        this.timeout = setTimeout(
          continuePayment,
          this.shouldRetryImmediately ? 0 : this.intervalInMs,
        );
      }, waitTime);
    }
  }

  private async sendMonetizationEvent(payload: MonetizationEventPayload) {
    await this.message.sendToTab(
      this.tabId,
      this.frameId,
      'MONETIZATION_EVENT',
      payload,
    );
  }

  private get canContinuePayment() {
    return this.active && !this.isDisabled && !this.isInvalid;
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

  async pay(amount: number): Promise<OutgoingPayment> {
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
        amount: (amount * 10 ** this.sender.assetScale).toFixed(0),
      });

      this.sendMonetizationEvent({
        requestId: this.requestId,
        details: {
          amountSent: {
            currency: outgoingPayment.receiveAmount.assetCode,
            value: transformBalance(
              outgoingPayment.receiveAmount.value,
              outgoingPayment.receiveAmount.assetScale,
            ),
          },
          incomingPayment: outgoingPayment.receiver,
          paymentPointer: this.receiver.id,
        },
      });

      return outgoingPayment;
    } catch (e) {
      if (isKeyRevokedError(e)) {
        this.events.emit('open_payments.key_revoked');
        throw e;
      } else if (isTokenExpiredError(e)) {
        await this.outgoingPaymentGrantService.rotateToken();
        return await this.pay(amount); // retry
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

  private setAmount(amount: bigint): void {
    this.amount = amount.toString();
    this.intervalInMs = Number((amount * BigInt(HOUR_MS)) / BigInt(this.rate));
  }

  private async payContinuous() {
    this.shouldRetryImmediately = false;
    try {
      const outgoingPayment = await this.createOutgoingPayment({
        walletAddress: this.sender,
        incomingPaymentId: this.incomingPaymentUrl,
        amount: this.amount,
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

      this.sendMonetizationEvent({
        requestId: this.requestId,
        details: monetizationEventDetails,
      });

      // TO DO: find a better source of truth for deciding if overpaying is applicable
      if (this.intervalInMs > 1000) {
        this.tabState.saveOverpaying(this.tabId, this.url, {
          walletAddressId: this.receiver.id,
          monetizationEvent: monetizationEventDetails,
          intervalInMs: this.intervalInMs,
        });
      }
    } catch (e) {
      if (isKeyRevokedError(e)) {
        this.events.emit('open_payments.key_revoked');
      } else if (isTokenExpiredError(e)) {
        await this.outgoingPaymentGrantService.rotateToken();
        this.shouldRetryImmediately = true;
      } else if (isOutOfBalanceError(e)) {
        const switched = await this.outgoingPaymentGrantService.switchGrant();
        if (switched === null) {
          this.events.emit('open_payments.out_of_funds');
        } else {
          this.shouldRetryImmediately = true;
        }
      } else if (isInvalidReceiverError(e)) {
        if (Date.now() >= this.incomingPaymentExpiresAt) {
          await this.setIncomingPaymentUrl(true);
          this.shouldRetryImmediately = true;
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
          } else {
            this.shouldRetryImmediately = true;
          }
        }
      } else {
        throw e;
      }
    }
  }
}
