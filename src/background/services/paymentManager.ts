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
    this.createStreamIfNotExists(0);
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
      this.createStreamIfNotExists(0);
    }

    if (!this.enabledSessions.length) {
      this.#state = 'stopped';
    }

    return removed;
  }

  deactivateSession(sessionId: SessionId, frameId?: FrameId) {
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

  get size() {
    return this.sessions.length; // TODO: make this more efficient
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
    return this.sessions.filter((s) => s.isUsable);
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
        PaymentSession,
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
    if (this.#state === 'active') {
      this.timer.reset(this.interval.duration);
    }
  }

  private pendingAmount = 0n;
  private iter: PeekAbleIterator<PaymentSession>;
  async start() {
    if (this.#state === 'active') {
      this.logger.warn('Already active');
      return;
    }
    this.#state = 'active';

    const sessions = this.payableSessions;
    this.logger.debug(`Starting ${sessions.length} sessions`, {
      sessions: sessions.map((s) => [s.id, s.walletAddress]),
    });

    if (!sessions.length) {
      this.logger.warn('No sessions to start');
      return;
    }

    // find last payment timestamp, wait as per interval for next payment.
    // ... if there was a last payment, emit monetization event (for last one)
    await this.preventOverpaying();
    if (this.#state !== 'active') {
      return;
    }

    this.iter ??= this.setupSessionIterator();
    const session = this.consumeSession();
    if (!session) {
      this.logger.error('No session to pay');
      return;
    }
    const amount = bigIntMax(this.interval.units, session.minSendAmount);
    void session.payWithRetry(amount).then((paid) => {
      if (!paid) this.pendingAmount += amount;
    });
    this.pendingAmount -= amount;

    this.checkAndPayContinuously();
    this.timer.reset(this.interval.duration);
  }

  pause(reason?: string) {
    this.logger.debug(`Pausing sessions [reason: ${reason}]`);
    this.timer.pause();
    this.#state = 'paused';
  }

  resume() {
    const sessions = this.enabledSessions;
    this.logger.debug(`Resuming ${sessions.length} sessions`);
    for (const session of sessions) {
      session.activate();
    }
    this.timer.resume();
    this.#state = 'active';
  }

  stop(reason?: string) {
    this.logger.debug(`Stopping sessions [reason: ${reason}]`);
    this.timer.clear();
    this.#state = 'stopped';
  }

  private async preventOverpaying(): Promise<boolean> {
    const lastPaymentInfo = this.getLastPayment();
    if (lastPaymentInfo) {
      const elapsed = Date.now() - lastPaymentInfo.ts.valueOf();
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
        return true;
      }
    }
    return false;
  }

  private getLastPayment() {
    return this.deps.tabState.getLastPaymentDetails(this.tabId, this.url);
  }

  private checkAndPayContinuously = () => {
    this.logger.debug(
      'checkAndPayContinuously:',
      `sessions=${this.size}`,
      this.#state,
      this.pendingAmount,
    );
    if (this.#state !== 'active' || !this.size) {
      return;
    }

    this.pendingAmount += this.interval.units;
    this.timer.reset(this.interval.duration); // as if setInterval

    const session = this.peekSessionToPay();
    if (!session) {
      this.logger.warn('No session to pay');
      return;
    }

    this.logger.debug('checkAndPayContinuously', {
      pendingAmount: this.pendingAmount,
      sessionIdToPay: session.id,
    });
    if (this.pendingAmount >= session.minSendAmount) {
      this.consumeSession();
      const amount = this.getPayableAmount(session);
      void session.payWithRetry(amount).then((paid) => {
        if (!paid) this.pendingAmount += amount;
      });
      this.pendingAmount -= amount;
    }
  };

  /**
   * For current {@linkcode pendingAmount} and a given session, see how much of
   * pending amount we can utilize in one go.
   */
  private getPayableAmount(session: PaymentSession): bigint {
    const minSendAmount = session.minSendAmount;
    const mul = this.pendingAmount / minSendAmount;
    return mul > 0n ? mul * minSendAmount : minSendAmount;
  }

  private peekSessionToPay(): PaymentSession {
    this.iter ??= this.setupSessionIterator();
    return this.iter.peek().value;
  }

  private consumeSession(): PaymentSession {
    this.iter ??= this.setupSessionIterator();
    return this.iter.next().value;
  }

  private setupSessionIterator() {
    return new PeekAbleIterator(this.sessionIterator(this));
  }

  private *sessionIterator(
    self: PaymentManager,
  ): Generator<PaymentSession, never, never> {
    while (true) {
      if (!self.payableSessions.length) {
        // @ts-expect-error It's simpler this way
        this.iter = null;
        throw new Error('No sessions!!');
      }
      const streams = Array.from(self.streams.values());
      const stream = streams[self.index % streams.length];
      const session = stream.iter.next().value;
      if (session) {
        yield session;
      } else {
        self.toNextFrame();
      }
    }
  }

  private index = 0;
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
    private PaymentSessionConstructor: typeof PaymentSession,
    private deps: ConstructorParameters<typeof PaymentSession>[6],
  ) {}

  addSession(sessionId: SessionId, receiver: WalletAddress, isActive: boolean) {
    let session = this.#sessions.get(sessionId);
    if (session && isActive) {
      session.activate();
      session.enable(); // if was disabled earlier
      return session;
    }
    session = new this.PaymentSessionConstructor(
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

  // TODO: make this more efficient as it's called often
  get size() {
    return this.#sessions.size;
  }

  get sessions() {
    return [...this.#sessions.values()];
  }

  get payableSessions() {
    return this.sessions.filter((s) => s.isUsable);
  }

  get isTopFrame() {
    return this.frameId === 0;
  }

  #picked = new WeakSet<PaymentSession>();
  iter = (function* (
    self,
  ): Generator<PaymentSession | undefined, never, never> {
    while (true) {
      const session = self.payableSessions.find((s) => !self.#picked.has(s));
      if (session) {
        self.#picked.add(session);
        yield session;
      } else {
        self.#picked = new WeakSet<PaymentSession>();
        yield undefined;
      }
    }
  })(this);
}

class PeekAbleIterator<T> implements Iterator<T, never, never> {
  #peek: IteratorResult<T, never>;
  constructor(private iterator: Iterator<T, never>) {
    this.#peek = iterator.next();
  }

  next() {
    const curr = this.#peek;
    this.#peek = this.iterator.next();
    return curr;
  }

  peek() {
    return this.#peek;
  }

  [Symbol.iterator]() {
    return this;
  }
}
