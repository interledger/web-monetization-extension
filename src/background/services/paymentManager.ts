import type { AmountValue, FrameId, TabId, SessionId } from '@/shared/types';
import type {
  OutgoingPayment,
  WalletAddress,
} from '@interledger/open-payments';
import type { Cradle as Cradle_ } from '@/background/container';
import type { PaymentSession } from './paymentSession';
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
  | 'PaymentSession'
>;

/** Payable amount to increase by {@linkcode Interval.units} every {@linkcode Interval.duration}ms. */
type Interval = { units: bigint; duration: number };

const MS_IN_HOUR = 3600;

export class PaymentManager {
  private rootLogger: Cradle['rootLogger'];
  private logger: Cradle['logger'];

  private streams = new Map<FrameId, PaymentStream>();

  constructor(
    private tabId: TabId,
    private url: string,
    private sender: WalletAddress,
    hourlyRate: AmountValue,
    private deps: Cradle,
  ) {
    Object.assign(this, this.deps);
    this.createStreamIfNotExists(0); // ensure frameId=0 is first in iteration (priority)
    this.timer = new Timeout(0, this.checkAndPayContinuously);
    this.setRate(hourlyRate);
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
      this.createStreamIfNotExists(0); // ensure frameId=0 is first in iteration (priority)
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

  get minSendAmount(): bigint {
    return this.payableSessions.reduce(
      (prevMinSendAmount, { minSendAmount }) =>
        minSendAmount < prevMinSendAmount ? minSendAmount : prevMinSendAmount,
      BigInt(Number.MAX_SAFE_INTEGER),
    );
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
    if (!payableSessions.length) {
      throw new Error('No sessions to pay');
    }
    this.logger.debug(`pay(${amount}) to ${payableSessions.length} sessions`);

    const { remainingAmount, distribution } = distributeAmount(
      amount,
      payableSessions,
    );
    if (!distribution.size) {
      throw new Error(
        `Cannot distribute amount (${amount}) to current sessions`,
      );
    }

    this.logger.debug('sending outgoing payments', {
      amount: {
        total: amount.toString(),
        paying: (amount - remainingAmount).toString(),
        remaining: remainingAmount.toString(),
      },
      distribution: [...distribution].map(([s, amount]) => ({
        id: s.id,
        receiver: s.receiver.id,
        amount: amount.toString(),
      })),
    });
    const outgoingPaymentResults = await Promise.allSettled(
      [...distribution.entries()].map(([session, amount]) =>
        session.payOneTime(amount),
      ),
    );

    this.logger.debug('polling outgoing payments for completion');
    const result = await this.getPayStatus(
      outgoingPaymentResults,
      Array.from(distribution.keys()),
      signal,
    );

    return {
      amounts: { ...result, amount, remainingAmount },
      distribution: [...distribution.entries()].map(([session, amount]) => {
        const outgoingPayment = result.outgoingPayments.get(session.id);
        return {
          id: session.id,
          walletAddress: session.receiver.id,
          amount: amount.toString(),
          ...(outgoingPayment
            ? {
                debitAmount: outgoingPayment.debitAmount.value,
                sentAmount: outgoingPayment.sentAmount.value,
              }
            : {}),
        };
      }),
    };
  }

  private async getPayStatus(
    results: PromiseSettledResult<OutgoingPayment>[],
    payableSessions: PaymentSession[],
    signal?: AbortSignal,
  ) {
    const { isOutOfBalanceError } = await import('./openPayments');
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
  #state: 'stopped' | 'active' | 'paused' = 'stopped';
  private hourlyRate: bigint;
  private interval: Interval;
  private timer: Timeout;
  private pendingAmount = 0n;
  #iter: PeekAbleIterator<PaymentSession>;

  setRate(hourlyRate: AmountValue) {
    this.hourlyRate = BigInt(hourlyRate);
    const secondsPerUnit = MS_IN_HOUR / Number(this.hourlyRate);
    const duration = Math.ceil(secondsPerUnit * 1000);
    // The math below is equivalent to:
    // interval = { units: 1n, duration };
    // while (interval.duration < MIN_PAYMENT_WAIT) {
    //   interval.units += 1n;
    //   interval.duration += duration;
    // }
    const units = BigInt(Math.ceil(MIN_PAYMENT_WAIT / duration));
    this.interval = { units, duration: Number(units) * duration };
    // TODO: Optimization opportunity above: see if we can set interval based on
    // some minSendAmount (HCF of all minSendAmount?). i.e. we will increment
    // amount by minSendAmount unit to make the interval longer.

    if (this.#state === 'active') {
      this.timer.reset(this.interval.duration);
    }
  }

  async start() {
    if (this.#state === 'active') {
      this.logger.warn('Already active');
      return;
    }

    const sessions = this.payableSessions;
    if (!sessions.length) {
      this.logger.warn('No sessions to start');
      return;
    }
    // this.logger.debug(`Starting ${sessions.length} sessions`, {
    //   sessions: sessions.map((s) => [s.id, s.receiver.id]),
    // });

    this.#state = 'active';

    await this.preventOverpaying();
    if (this.#state !== 'active') {
      return;
    }

    this.#iter ??= this.setupSessionIterator();
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

  /**
   * If there was a payment in the last interval, we need to wait to respect the
   * payment interval, to avoid overpaying websites on each {@linkcode start()}
   * call (like on page refresh, adding/removing link tags etc.)
   */
  private async preventOverpaying(): Promise<boolean> {
    const lastPaymentInfo = this.getLastPayment();
    if (!lastPaymentInfo) {
      return false;
    }

    const elapsed = Date.now() - lastPaymentInfo.ts.valueOf();
    const waitTime = this.interval.duration - elapsed;
    if (waitTime > 0) {
      this.logger.log('[overpaying] Preventing overpaying:', {
        ...lastPaymentInfo,
        waitTime,
      });
      const session = this.sessions.find(
        // FIXME: in case `href` is different from walletAddressId
        (s) => s.receiver.id === lastPaymentInfo.walletAddressId,
      );
      if (session) {
        this.logger.debug(
          '[overpaying] Emitting MonetizationEvent for last payment',
        );
        session.sendMonetizationEvent(lastPaymentInfo.monetizationEvent);
      }
      await sleep(waitTime);
      return true;
    }

    return false;
  }

  private getLastPayment() {
    return this.deps.tabState.getLastPaymentDetails(this.tabId, this.url);
  }

  private checkAndPayContinuously = () => {
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

    // this.logger.debug('checkAndPayContinuously', {
    //   pendingAmount: this.pendingAmount,
    //   sessionIdToPay: session.id,
    // });
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
    this.#iter ??= this.setupSessionIterator();
    return this.#iter.peek().value;
  }

  private consumeSession(): PaymentSession {
    this.#iter ??= this.setupSessionIterator();
    return this.#iter.next().value;
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
        this.#iter = null;
        throw new Error('No sessions!!');
      }
      const streams = Array.from(self.streams.values());
      const stream = streams[self.frameIndex % streams.length];
      const session = stream.iter.next().value;
      if (session) {
        yield session;
        if (!stream.isTopFrame) {
          self.toNextFrame();
        }
      } else {
        self.toNextFrame();
      }
    }
  }

  private frameIndex = 0;
  private toNextFrame() {
    this.frameIndex = (this.frameIndex + 1) % this.streams.size;
  }
  // #endregion
}

export class PaymentStream {
  public iter: Iterator<PaymentSession | undefined, never, never>;

  #sessions = new Map<SessionId, PaymentSession>();
  constructor(
    private readonly frameId: FrameId,
    private readonly tabUrl: string,
    private readonly tabId: TabId,
    private sender: WalletAddress,
    private rootLogger: Cradle['rootLogger'],
    private deps: Cradle,
  ) {
    this.iter = this.sessionsIter(this);
  }

  addSession(sessionId: SessionId, receiver: WalletAddress, isActive: boolean) {
    let session = this.#sessions.get(sessionId);
    if (session && isActive) {
      session.activate();
      session.enable(); // if was disabled earlier
      return session;
    }
    session = new this.deps.PaymentSession(
      receiver,
      sessionId,
      this.tabId,
      this.frameId,
      this.tabUrl,
      this.sender,
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
    return this.sessions.filter((s) => s.isUsable);
  }

  get isTopFrame() {
    return this.frameId === 0;
  }

  #picked = new WeakSet<PaymentSession>();
  private *sessionsIter(
    self: PaymentStream,
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
  }
}

/**
 * Distribute {@linkcode amount} among all payable sessions.
 *
 * - Each session can have sendable amount allocated only in multiple of its
 *   {@linkcode PaymentSession.minSendAmount}.
 * - We try to distribute such that each session gets something.
 * - We also try to distribute amounts roughly equally across sessions.
 * - If there's not enough amount, some sessions won't have anything, and
 *   that's ok.
 * - We never pay more than {@linkcode amount}. Some amount may be leftover.
 * - The order of sessions is not changed to get an optimal distribution.
 *
 * @param sessions The payable sessions to distribute the amount into.
 *
 * @returns The distribution only includes sessions that have an amount > 0. A
 * leftover amount that could not be distributed is also returned.
 */
export function distributeAmount<
  PaymentSessionLike extends Pick<PaymentSession, 'minSendAmount'>,
>(
  amount: bigint,
  sessions: Array<PaymentSessionLike>,
): { distribution: Map<PaymentSessionLike, bigint>; remainingAmount: bigint } {
  const distribution = new Map<PaymentSessionLike, bigint>();
  let remainingAmount = amount;

  const targetSplit = amount / BigInt(sessions.length);
  for (const session of sessions) {
    const minSendAmount = session.minSendAmount;
    if (minSendAmount > remainingAmount) continue;

    const mul = targetSplit / minSendAmount;
    let splitAmount = mul * minSendAmount;
    if (splitAmount > remainingAmount) {
      splitAmount = (mul - 1n) * minSendAmount;
    }
    if (splitAmount <= 0n) continue;

    distribution.set(session, splitAmount);
    remainingAmount -= splitAmount;
  }

  while (remainingAmount > 0n) {
    let didAssign = false;
    for (const session of sessions) {
      if (remainingAmount <= 0n) break;

      const currentSplit = distribution.get(session) ?? 0n;
      const minSendAmount = session.minSendAmount;

      if (remainingAmount >= minSendAmount) {
        distribution.set(session, currentSplit + minSendAmount);
        remainingAmount -= minSendAmount;
        didAssign = true;
      }
    }
    if (!didAssign) break;
  }

  return { distribution, remainingAmount };
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
