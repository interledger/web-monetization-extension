/**
 *
 * Monetization (entire browser one instance)
 *  -> PaymentStreamManager (per tab)
 *  -> PaymentStream (per frame)
 *  -> PaymentSession (per link tag)
 *
 * tab.id -> PaymentStreamManager
 * START_MONETIZATION : addSession
 *
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

import type { AmountValue, FrameId, TabId } from '@/shared/types';
import type { WalletAddress } from '@interledger/open-payments';
import type { Cradle as Cradle_ } from '@/background/container';
import { PaymentSession } from './paymentSession';
import { getNth } from '@/shared/helpers';

type SessionId = string;
type Cradle = Pick<
  Cradle_,
  | 'logger'
  | 'storage'
  | 'openPaymentsService'
  | 'outgoingPaymentGrantService'
  | 'events'
  | 'tabState'
  | 'message'
>;

export class PaymentStreamManager {
  private logger: Cradle['logger'];
  private storage: Cradle['storage'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private events: Cradle['events'];
  private tabState: Cradle['tabState'];
  private message: Cradle['message'];

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
    this.hourlyRate = BigInt(hourlyRate);
  }

  addSession(
    frameId: number,
    sessionId: SessionId,
    receiver: WalletAddress,
    isActive: boolean,
  ) {
    let stream = this.streams.get(frameId);
    if (!stream) {
      stream = new PaymentStream(
        frameId,
        this.url,
        this.tabId,
        this.sender,
        this.deps,
      );
      this.streams.set(frameId, stream);
    }
    const session = stream.addSession(sessionId, receiver);
    void session.findMinSendAmount(); // TODO: await here or later ok?
  }

  removeSession(frameId: number, sessionId: SessionId) {
    this.streams.get(frameId)?.removeSession(sessionId);
  }

  changeRate(hourlyRate: AmountValue) {
    this.hourlyRate = BigInt(hourlyRate);
    // TODO
  }

  start() {}

  pause(reason: string) {}

  resume() {}

  stop(reason: string) {}

  async pay(amount: bigint) {
    const sessionsAndAmounts = new Map<PaymentSession, bigint>();
    let remainingAmount = amount;
    for (const frameId of this.streams.keys()) {
      const stream = this.streams.get(frameId)!;
      const sessions = stream.getAllPayable();
      for (const session of sessions) {
        if (session.minSendAmount <= remainingAmount) {
          sessionsAndAmounts.set(session, session.minSendAmount);
          remainingAmount -= session.minSendAmount;
        }
      }
    }
  }

  private index = 0;
  private getSessionToPay(): PaymentSession {
    const stream = getNth(this.streams.values(), this.index);
    if (stream) {
      const session = stream.getNext();
      if (session) {
        if (stream.isTopFrame) {
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
}

export class PaymentStream {
  private sessions = new Map<SessionId, PaymentSession>();

  constructor(
    private frameId: FrameId,
    private url: string,
    private tabId: TabId,
    private sender: WalletAddress,
    private deps: ConstructorParameters<typeof PaymentSession>[6],
  ) {}

  addSession(sessionId: SessionId, receiver: WalletAddress) {
    const session = new PaymentSession(
      receiver,
      this.sender,
      sessionId,
      this.tabId,
      this.frameId,
      this.url,
      this.deps,
    );
    this.sessions.set(sessionId, session);
    return session;
  }

  removeSession(sessionId: SessionId) {
    this.sessions.delete(sessionId);
  }

  get isTopFrame() {
    return this.frameId === 0;
  }

  private index = -1;
  getNext(): PaymentSession | undefined {
    const nextIdx = (this.index + 1) % this.sessions.size;
    this.index = nextIdx;
    return getNth(this.sessions.values(), nextIdx, isUsable);
  }

  peekNext(): PaymentSession | undefined {
    const nextIdx = (this.index + 1) % this.sessions.size;
    return getNth(this.sessions.values(), nextIdx, isUsable);
  }

  getAllPayable() {
    return [...this.sessions.values()].filter(isUsable);
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
