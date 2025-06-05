import type { AmountValue, FrameId, TabId, SessionId } from '@/shared/types';
import type {
  OutgoingPayment,
  WalletAddress,
} from '@interledger/open-payments';
import type { Cradle as Cradle_ } from '@/background/container';
import { PaymentSession } from './paymentSession';
import {
  MIN_PAYMENT_WAIT,
  OUTGOING_PAYMENT_POLLING_MAX_ATTEMPTS,
} from '../config';
import { bigIntMax } from '../utils';
import {
  ErrorWithKey,
  isAbortSignalTimeout,
  isErrorWithKey,
  sleep,
  Timeout,
} from '@/shared/helpers';
import { isOutOfBalanceError } from './openPayments';

type Cradle = Pick<
  Cradle_,
  | 'logger'
  | 'rootLogger'
  | 'storage'
  | 'openPaymentsService'
  | 'outgoingPaymentGrantService'
  | 'events'
  | 'tabState'
  | 'message'
>;

type Interval = {
  /** Payable amount to increase every {@linkcode Interval.duration} */
  units: bigint;
  /** Duration in milliseconds */
  duration: number;
};

const MS_IN_HOUR = 3600;

export class PaymentManager {
  private rootLogger: Cradle['rootLogger'];
  private logger: Cradle['logger'];

  private streams = new Map<FrameId, PaymentStream>();

  private hourlyRate: bigint;
  private interval: Interval;
  private timer: Timeout;
  #state: 'stopped' | 'active' | 'paused' = 'stopped';

  constructor(
    private tabId: TabId,
    private url: string,
    private sender: WalletAddress,
    hourlyRate: AmountValue,
    private deps: Cradle,
  ) {
    Object.assign(this, this.deps);
    this.hourlyRate = BigInt(hourlyRate);
    this.timer = new Timeout(0, this.checkAndPayContinuously);
    void this.setRate(hourlyRate);
  }

  get info() {
    return {
      tabId: this.tabId,
      url: this.url,
      frames: this.streams.size,
      state: this.#state,
      sessions: {
        total: this.sessions.length,
        enabled: this.enabledSessions.length,
        payable: this.payableSessions.length,
      },
    };
  }

  // #region Session management
  async addSession(
    frameId: number,
    sessionId: SessionId,
    receiver: WalletAddress,
    isActive: boolean,
  ): Promise<PaymentSession> {
    // TODO: try to follow order of frames and sessions as on page. Otherwise,
    // it's ordered by "discovery" (when we discovered it).

    const stream = this.createStreamIfNotExists(frameId);
    const session = stream.addSession(sessionId, receiver, isActive);
    try {
      await session.findMinSendAmount();
    } catch (error) {
      this.logger.warn('Failed to find min send amount', {
        error,
        tabId: this.tabId,
        frameId,
        sessionId,
      });
    }
    return session;
  }

  /**
   * Removes a session by ID.
   *
   * If there are no more sessions for that frameId, remove the PaymentStream
   * for that frame. This is needed as PaymentManager isn't always destroyed
   * when a tab is refreshed, but we still get `removeSession` calls from
   * `STOP_MONETIZATION` messages. So, we "empty out" the PaymentManager there,
   * as we're not sure if it can be safely destroyed at that stage.
   *
   * @returns true if session was removed
   */
  removeSession(sessionId: SessionId, frameId?: FrameId): boolean {
    // biome-ignore lint/style/noParameterAssign: it's cleaner and simpler
    frameId ??= this.findFrameIdBySessionId(sessionId);
    if (typeof frameId === 'undefined') return false;

    const stream = this.streams.get(frameId);
    if (!stream) return false;

    const removed = stream.removeSession(sessionId);
    if (removed && !stream.size) {
      this.streams.delete(frameId);
    }

    if (!this.enabledSessions.length) {
      this.#state = 'stopped';
    }

    return removed;
  }

  stopSession(sessionId: SessionId, frameId?: FrameId) {
    // this is essentially to remove this session from list of payments
    // TODO: see when this is triggered. On _PAUSE_MONETIZATION_?
    return this.getSession(sessionId, frameId)?.deactivate() ?? false;
  }

  // To enable, call addSession with isActive=true. It'll reuse the existing
  // session and enable it.
  disableSession(sessionId: SessionId, frameId?: FrameId) {
    return this.getSession(sessionId, frameId)?.disable() ?? false;
  }

  getSession(sessionId: SessionId, frameId?: FrameId) {
    if (typeof frameId !== 'undefined') {
      return this.streams.get(frameId)?.getSession(sessionId);
    }
    for (const stream of this.streams.values()) {
      const session = stream.getSession(sessionId);
      if (session) return session;
    }
  }

  get sessions() {
    return Array.from(this.streams.values()).flatMap(
      (stream) => stream.sessions,
    );
  }

  get enabledSessions() {
    return this.sessions.filter((s) => !s.disabled);
  }

  get payableSessions() {
    return this.sessions.filter(isUsable);
  }

  private createStreamIfNotExists(frameId: FrameId) {
    let stream = this.streams.get(frameId);
    if (!stream) {
      stream = new PaymentStream(
        frameId,
        this.url,
        this.tabId,
        this.sender,
        this.rootLogger,
        this.deps,
      );
      this.streams.set(frameId, stream);
    }
    return stream;
  }

  private findFrameIdBySessionId(sessionId: SessionId): FrameId | undefined {
    for (const [frameId, stream] of this.streams) {
      if (stream.getSession(sessionId)) {
        return frameId;
      }
    }
  }
  // #endregion

  // #region One time payment
  async pay(amount: bigint, signal?: AbortSignal) {
    const payableSessions = this.payableSessions;
    this.logger.debug(`pay(${amount}) to ${payableSessions.length} sessions`);

    const splitAmount = amount / BigInt(payableSessions.length);
    const results = await Promise.allSettled(
      payableSessions.map((session) => session.payOneTime(splitAmount)),
    );

    this.logger.debug('polling outgoing payments for completion');
    const result = await this.getPayStatus(results, payableSessions, signal);

    return {
      amounts: {
        ...result,
        amount: amount.toString(),
      },
    };
  }

  private async getPayStatus(
    results: PromiseSettledResult<OutgoingPayment>[],
    payableSessions: PaymentSession[],
    signal?: AbortSignal,
  ) {
    const outgoingPayments = new Map<string, OutgoingPayment | null>(
      payableSessions.map((session, i) => [
        session.id,
        results[i].status === 'fulfilled' ? results[i].value : null,
      ]),
    );

    const pollingResults = await Promise.allSettled(
      [...outgoingPayments]
        .filter(([, outgoingPayment]) => outgoingPayment !== null)
        .map(async ([sessionId, outgoingPaymentInitial]) => {
          const session = payableSessions.find((s) => s.id === sessionId);
          if (!session) {
            this.logger.error('Could not find session for outgoing payment.');
            return null;
          }
          for await (const outgoingPayment of session.pollOutgoingPayment(
            // Null assertion: https://github.com/microsoft/TypeScript/issues/41173
            outgoingPaymentInitial!.id,
            {
              signal,
              maxAttempts: OUTGOING_PAYMENT_POLLING_MAX_ATTEMPTS,
            },
          )) {
            outgoingPayments.set(sessionId, outgoingPayment);
          }
          return outgoingPayments.get(sessionId);
        }),
    );

    const sentAmount = [...outgoingPayments.values()].reduce(
      (acc, op) => acc + BigInt(op?.sentAmount?.value ?? 0),
      0n,
    );
    const debitAmount = [...outgoingPayments.values()].reduce(
      (acc, op) => acc + BigInt(op?.debitAmount?.value ?? 0),
      0n,
    );

    if (sentAmount === 0n) {
      const pollingErrors = pollingResults
        .filter((e) => e.status === 'rejected')
        .map((e) => e.reason);

      if (pollingErrors.some((e) => e.message === 'InsufficientGrant')) {
        this.logger.warn('Insufficient grant to read outgoing payments');
        // This permission request to read outgoing payments was added at a
        // later time, so existing connected wallets won't have this permission.
        // Assume as success for backward compatibility.
        return { sentAmount, debitAmount, outgoingPayments };
      }

      const isNotEnoughFunds = results
        .filter((e) => e.status === 'rejected')
        .some((e) => isOutOfBalanceError(e.reason));
      const isPollingLimitReached = pollingErrors.some(
        (err) =>
          (isErrorWithKey(err) &&
            err.key === 'pay_warn_outgoingPaymentPollingIncomplete') ||
          isAbortSignalTimeout(err),
      );

      if (isNotEnoughFunds) {
        throw new ErrorWithKey('pay_error_notEnoughFunds');
      }
      if (isPollingLimitReached) {
        throw new ErrorWithKey('pay_warn_outgoingPaymentPollingIncomplete');
      }
      throw new ErrorWithKey('pay_error_general');
    }

    return { sentAmount, debitAmount, outgoingPayments };
  }
  // #endregion

  // #region Streaming payments
  async setRate(hourlyRate: AmountValue) {
    this.hourlyRate = BigInt(hourlyRate);
    const secondsPerUnit = MS_IN_HOUR / Number(this.hourlyRate);
    const duration = Math.ceil(secondsPerUnit * 1000);
    // TODO: see if we can set interval based on some minSendAmount (HCF of all
    // minSendAmount?)
    this.interval = { units: 1n, duration };
    while (this.interval.duration < MIN_PAYMENT_WAIT) {
      this.interval.units += 1n;
      this.interval.duration += duration;
    }
    this.logger.debug(`Setting hourly rate to ${hourlyRate},
       or, ${Number(this.hourlyRate) / 3600}c every second
       or ${1}unit every ${secondsPerUnit} seconds
       :> ${this.interval.units}unit every ${this.interval.duration}ms`);
    this.timer.reset(this.interval.duration);
  }

  private pendingAmount = 0n;
  async start() {
    const sessions = this.payableSessions;
    this.logger.debug(`Starting ${sessions.length} sessions`);

    // find last payment timestamp, wait as per interval for next payment.
    // ... if there was a last payment, emit monetization event (for last one)
    const lastPaymentInfo = this.getLastPayment();
    if (lastPaymentInfo) {
      const elapsed = Date.now() - lastPaymentInfo.lastPaymentAt.valueOf();
      const waitTime = this.interval.duration - elapsed;
      if (waitTime > 0) {
        this.logger.log('[overpaying] Preventing overpaying:', {
          ...lastPaymentInfo,
          waitTime,
        });
        const session = this.sessions.find(
          // FIXME: in case `href` is different from walletAddressId
          (s) => s.walletAddress === lastPaymentInfo.walletAddressId,
        );
        if (session) {
          this.logger.debug(
            '[overpaying] Emitting monetization event for last payment',
          );
          session.sendMonetizationEvent(lastPaymentInfo.monetizationEvent);
        }
        await sleep(waitTime);
        if (this.#state === 'active') {
          return;
        }
      }
    }

    if (this.#state !== 'active') {
      const session = this.getSessionToPay();
      const amount = bigIntMax(this.interval.units, session.minSendAmount);
      void session.payWithRetry(amount);
      this.pendingAmount -= amount;
    }

    this.timer.reset(this.interval.duration);
    this.#state = 'active';
  }

  pause(reason?: string) {
    this.logger.debug(`Pausing sessions [reason: ${reason}]`);
    this.timer.pause();
    this.#state = 'paused';
  }

  resume() {
    const sessions = this.enabledSessions;
    this.logger.debug(`Resuming ${sessions.length} sessions`);
    this.timer.resume();
    this.#state = 'active';
  }

  stop(reason?: string) {
    this.logger.debug(`Stopping sessions [reason: ${reason}]`);
    this.timer.clear();
    this.#state = 'stopped';
  }

  private getLastPayment() {
    return this.deps.tabState.getLastPaymentDetails(this.tabId, this.url);
  }

  private checkAndPayContinuously = () => {
    if (this.#state !== 'active') {
      return;
    }

    this.pendingAmount += this.interval.units;
    const session = this.peekSessionToPay();
    this.logger.debug('checkAndPayContinuously', {
      pendingAmount: this.pendingAmount,
      sessionIdToPay: session.id,
    });
    if (this.pendingAmount >= session.minSendAmount) {
      const s = this.getSessionToPay();
      if (s.id !== session.id) {
        this.logger.warn(
          `Unexpected session: expected ${session.id} but got ${s.id}`,
        );
      }
      const amount = this.getPayableAmount(session);
      void session.pay(amount);
      this.pendingAmount -= amount;
    }
    this.timer.reset(this.interval.duration);
  };

  /**
   * For current {@linkcode pendingAmount} and a given session, see how much of
   * pending amount we can utilize in one go.
   */
  private getPayableAmount(session: PaymentSession): bigint {
    const minSendAmount = session.minSendAmount;
    const amount = this.pendingAmount / minSendAmount;
    return amount > 0n ? amount : minSendAmount;
  }

  private index = 0;
  private getSessionToPay(): PaymentSession {
    const stream = [...this.streams.values()][this.index];
    if (stream) {
      const session = stream.getNext();
      if (session) {
        if (!stream.isTopFrame) {
          this.toNextFrame();
        }
        return session;
      }
    }
    this.toNextFrame();
    return this.getSessionToPay();
  }

  private peekSessionToPay(frameIndex = this.index): PaymentSession {
    const stream = [...this.streams.values()][frameIndex];
    if (stream) {
      const session = stream.peekNext();
      if (session) {
        return session;
      }
    }
    return this.peekSessionToPay(this.nextFrameIndex(frameIndex));
  }

  private toNextFrame() {
    this.index = this.nextFrameIndex(this.index);
  }

  private nextFrameIndex(frameIndex: number) {
    return (frameIndex + 1) % this.streams.size;
  }
  // #endregion
}

export class PaymentStream {
  #sessions = new Map<SessionId, PaymentSession>();

  constructor(
    private frameId: FrameId,
    private url: string,
    private tabId: TabId,
    private sender: WalletAddress,
    private rootLogger: Cradle['rootLogger'],
    private deps: ConstructorParameters<typeof PaymentSession>[6],
  ) {}

  addSession(sessionId: SessionId, receiver: WalletAddress, isActive: boolean) {
    let session = this.#sessions.get(sessionId);
    if (session && isActive) {
      session.activate();
      session.enable(); // if was disabled earlier
      return session;
    }
    session = new PaymentSession(
      receiver,
      this.sender,
      sessionId,
      this.tabId,
      this.frameId,
      this.url,
      {
        ...this.deps,
        logger: this.rootLogger.getLogger(`payment-session/${sessionId}`),
      },
    );
    this.#sessions.set(sessionId, session);
    return session;
  }

  removeSession(sessionId: SessionId) {
    const session = this.#sessions.get(sessionId);
    session?.deactivate();
    return this.#sessions.delete(sessionId);
  }

  getSession(sessionId: SessionId) {
    return this.#sessions.get(sessionId);
  }

  get size() {
    return this.#sessions.size;
  }

  get sessions() {
    return [...this.#sessions.values()];
  }

  get payableSessions() {
    return this.sessions.filter(isUsable);
  }

  get isTopFrame() {
    return this.frameId === 0;
  }

  private index = -1;
  getNext(): PaymentSession | undefined {
    const payableSessions = this.payableSessions;
    const nextIdx = (this.index + 1) % payableSessions.length;
    const session = payableSessions.at(nextIdx);
    if (session) {
      this.index = nextIdx;
    }
    return session;
  }

  peekNext(currentIndex = this.index): PaymentSession | undefined {
    const payableSessions = this.payableSessions;
    const nextIdx = (currentIndex + 1) % payableSessions.length;
    return payableSessions.at(nextIdx);
  }
}

function isUsable(session: PaymentSession) {
  try {
    void session.minSendAmount;
  } catch {
    return false;
  }
  return session.active && !session.invalid && !session.disabled;
}
