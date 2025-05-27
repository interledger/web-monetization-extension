import type { AmountValue, FrameId, TabId, SessionId } from '@/shared/types';
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

  private streams = new Map<FrameId, PaymentStream>();
  private lastPaymentTimestamp = 0;

  constructor(
    private tabId: TabId,
    private url: string,
    private sender: WalletAddress,
    private hourlyRate: AmountValue,
    private deps: Cradle,
  ) {
    Object.assign(this, this.deps);
    this.logger = this.rootLogger.getLogger(
      `payment-manager/${new URL(url).host}`,
    );

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
    this.hourlyRate = hourlyRate;
    // TODO
  }

  // #region One time payment
  async pay(amount: bigint, verifySignal?: AbortSignal) {}

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
  start() {
    // check overpaying
  }

  pause(reason: string) {}

  resume() {}

  stop(reason: string) {}
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
}

function isUsable(session: PaymentSession) {
  try {
    void session.minSendAmount;
  } catch {
    return false;
  }
  return !session.invalid && !session.disabled;
}
