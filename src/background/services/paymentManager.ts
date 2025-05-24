/**
 *
 * Monetization (entire browser one instance)
 *  -> PaymentManager (per tab)
 *  -> PaymentStream (per frame)
 *  -> PaymentSession (per link tag)
 *
 * tab.id -> PaymentManager
 * START_MONETIZATION : addSession
 *
 */

import type { AmountValue, FrameId, TabId } from '@/shared/types';
import type {
  OutgoingPayment,
  WalletAddress,
} from '@interledger/open-payments';
import type { Cradle as Cradle_ } from '@/background/container';
import { PaymentSession } from './paymentSession';
import { OUTGOING_PAYMENT_POLLING_MAX_ATTEMPTS } from '../config';
import {
  ErrorWithKey,
  isAbortSignalTimeout,
  isErrorWithKey,
} from '@/shared/helpers';
import { isOutOfBalanceError } from './openPayments';

type SessionId = string;
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

export class PaymentManager {
  private rootLogger: Cradle['rootLogger'];
  private logger: Cradle['logger'];

  /**
   * `frameId=0` is always first, so it gets higher priority.
   */
  private streams = new Map<FrameId, PaymentStream>();
  private hourlyRate: bigint;
  private lastPaymentTimestamp = 0;

  constructor(
    private tabId: TabId,
    private url: string,
    private sender: WalletAddress,
    hourlyRate: AmountValue,
    private deps: Cradle,
  ) {
    Object.assign(this, this.deps);
    this.logger = this.rootLogger.getLogger(
      `payment-manager/${new URL(url).host}`,
    );
    this.hourlyRate = BigInt(hourlyRate);

    // ensure frameId=0 is first in this.streams
    this.createStreamIfNotExists(0);
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

  removeSession(frameId: FrameId, sessionId: SessionId) {
    return this.streams.get(frameId)?.removeSession(sessionId);
  }

  stopSession(frameId: FrameId, sessionId: SessionId) {
    return this.streams.get(frameId)?.getSession(sessionId)?.stop();
  }

  disableSession(frameId: FrameId, sessionId: SessionId) {
    return this.streams.get(frameId)?.getSession(sessionId)?.disable();
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
  // #endregion

  changeRate(hourlyRate: AmountValue) {
    this.hourlyRate = BigInt(hourlyRate);
    // TODO
  }

  start() {
    // check overpaying
  }

  pause(reason: string) {}

  resume() {}

  stop(reason: string) {}

  // #region One time payment
  async pay(amount: bigint, verifySignal?: AbortSignal) {
    const { remainingAmount, distribution } = this.distributeAmount(amount);

    /*
    console.log({ amount, remainingAmount });
    console.table(
      [...distribution.entries()].map(([session, amount]) => ({
        sessionId: session.id,
        walletAddress: session.walletAddress,
        amount: amount.toString(),
      })),
    );
    */

    // TODO: handle paying across two grants (when one grant doesn't have enough funds)
    const outgoingPaymentResults = await Promise.allSettled(
      [...distribution.entries()].map(([session, amount]) =>
        session.pay(amount),
      ),
    );

    const payableSessions = Array.from(distribution.keys());

    this.logger.debug('polling outgoing payments for completion');
    const result = await this.getPayStatus(
      outgoingPaymentResults,
      payableSessions,
      verifySignal,
    );

    return {
      amounts: {
        ...result,
        amount: amount.toString(),
        remainingAmount: remainingAmount.toString(),
      },
      distribution: [...distribution.entries()].map(([session, amount]) => {
        const { id: sessionId, walletAddress } = session;
        const outgoingPayment = result.outgoingPayments.get(sessionId);
        return {
          sessionId,
          walletAddress,
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

  /**
   * Distribute {@linkcode amount} among all payable sessions.
   *
   * - Each session can have sendable amount allocated only in multiple of its
   *   {@linkcode PaymentSession.minSendAmount}.
   * - We try to distribute such that each session gets something.
   * - If there's not enough amount, some sessions won't have anything, and
   *   that's ok.
   * - We never pay more than {@linkcode amount}. Some amount may be leftover.
   * - The order of sessions is not changed to get an optimal distribution.
   *
   * @returns The distribution only includes sessions that have an amount > 0. A
   * leftover amount that could not be distributed is also returned.
   */
  private distributeAmount(amount: bigint) {
    let remainingAmount = amount;
    const distribution = new Map<PaymentSession, bigint>();

    // Try to give each session at least one of its 'minSendAmount's. This
    // ensures that if amount is moderately sufficient, it's spread out rather
    // than one session taking a large chunk initially.
    for (const frameId of this.streams.keys()) {
      const stream = this.streams.get(frameId)!;
      for (const session of stream.payableSessions) {
        const minSendAmount = session.minSendAmount;
        if (minSendAmount <= remainingAmount) {
          distribution.set(session, minSendAmount);
          remainingAmount -= minSendAmount;
        }
      }
    }

    // Optimization pass: This part efficiently distributes large portions of
    // remainingAmount if remainingAmount is large enough to give multiple
    // 'minSendAmount' units to all sessions simultaneously.
    if (remainingAmount > 0n && distribution.size) {
      const sumMinSend = [...distribution.keys()].reduce(
        (sum, session) => sum + session.minSendAmount,
        0n,
      );
      const numFullRounds = remainingAmount / sumMinSend; // bigint division is a Math.floor
      if (numFullRounds > 0n) {
        for (const [session, current] of distribution.entries()) {
          const payable = current + session.minSendAmount * numFullRounds;
          distribution.set(session, payable);
        }
        remainingAmount -= sumMinSend * numFullRounds;
      }
    }

    // This part distributes one minSendAmount at a time to each session in a
    // round-robin manner, so we utilize most of the amount.
    let changedInThisRound = true;
    while (changedInThisRound && remainingAmount > 0n) {
      changedInThisRound = false; // reset for this round
      for (const [session, current] of distribution.entries()) {
        const minSendAmount = session.minSendAmount;
        if (minSendAmount <= remainingAmount) {
          distribution.set(session, current + minSendAmount);
          remainingAmount -= minSendAmount;
          changedInThisRound = true;
        }
      }
    }

    return { distribution, remainingAmount };
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
  /**
   * say, 60c per hour.
   * that's 0.0167c per second. minPayable is say, 1c. So, 1c every 60s.
   * Save interval = 60*1000
   *
   * make payment to first session that has minPayable 1c
   *
   * pick a session (except first): send 1c
   * setTimeout(60s)
   * pick another session: send 1c
   * setTimeout(60s)
   *
   * say we've a session now that has min payable 2c:
   * skip payment for now, add 60s to timer, pay now.
   *
   * say we've a session now that has min payable 1.5c:
   * skip payment for now, add 30s to timer, pay now.
   *
   * Tab switched? pause timer. preserve current timestamp
   * On resume, adjust initial timer with above timestamp adjusted.
   *
   * ## How to pick session?
   *
   * First go sequentially through all sessions with frameId = 0
   * Then get first session from other frameId (preserve which was picked)
   * Then get first session from some other frameId (preserve which was picked)
   * Then go again through all sessions with frameId = 0
   * Then get next session from other frameId (preserve which was picked)
   * Then get next session from some other frameId (preserve which was picked)
   *
   * ## What if the rate of pay is 2c every 60s?
   *
   * Pick two sessions each time.
   *
   * What if rate of pay is 1 every second?
   * Keep picking, keep paying.
   */

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

  private toNextFrame() {
    this.index = (this.index + 1) % this.streams.size;
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
    // TODO: stopping isn't needed I guess?
    return this.#sessions.delete(sessionId);
  }

  getSession(sessionId: SessionId) {
    return this.#sessions.get(sessionId);
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
  return !session.invalid && !session.disabled;
}
