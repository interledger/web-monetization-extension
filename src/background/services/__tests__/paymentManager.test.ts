import { distributeAmount } from '../paymentManager';

describe('one time payments / distributeAmount', () => {
  class PaymentSession {
    constructor(
      public readonly minSendAmount: bigint,
      public readonly id = `#${++i}`,
    ) {}
  }
  const ps = (minSendAmount: bigint) => new PaymentSession(minSendAmount);

  let i = 0;
  beforeEach(() => {
    i = 0;
  });

  it('should distribute amount evenly across sessions', () => {
    const amount = 300n;
    const sessions = [ps(10n), ps(20n), ps(30n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(0n);
    expect([...res.distribution.entries()]).toEqual([
      [sessions[0], 110n],
      [sessions[1], 100n],
      [sessions[2], 90n],
    ]);
  });

  it('should handle distribution with remaining amount', () => {
    const amount = 352n;
    const sessions = [ps(10n), ps(20n), ps(30n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(2n);
    expect([...res.distribution.entries()]).toEqual([
      [sessions[0], 140n],
      [sessions[1], 120n],
      [sessions[2], 90n],
    ]);
  });

  it('should handle distribution with insufficient amount', () => {
    const amount = 100n;
    const sessions = [ps(100n), ps(200n), ps(300n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(0n);
    expect([...res.distribution.entries()]).toEqual([[sessions[0], 100n]]);
  });

  it('should distribute amount with one session', () => {
    const amount = 100n;
    const sessions = [ps(10n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(0n);
    expect([...res.distribution.entries()]).toEqual([[sessions[0], 100n]]);
  });

  it('should distribute amount with one session #2', () => {
    const amount = 103n;
    const sessions = [ps(10n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(3n);
    expect([...res.distribution.entries()]).toEqual([[sessions[0], 100n]]);
  });

  it('should distribute amount with minSendAmount = 1', () => {
    const amount = 123n;
    const sessions = [ps(1n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(0n);
    expect([...res.distribution.entries()]).toEqual([[sessions[0], 123n]]);
  });

  it('should distribute amount with minSendAmount = 1 #2', () => {
    const amount = 123n;
    const sessions = [ps(1n), ps(1n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(0n);
    expect([...res.distribution.entries()]).toEqual([
      [sessions[0], 62n],
      [sessions[1], 61n],
    ]);
  });

  it('should distribute amount with sessions having the same minSendAmount', () => {
    const amount = 300n;
    const sessions = [ps(10n), ps(10n), ps(10n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(0n);
    expect([...res.distribution.entries()]).toEqual([
      [sessions[0], 100n],
      [sessions[1], 100n],
      [sessions[2], 100n],
    ]);
  });

  it('should distribute amount with sessions having the same minSendAmount #2', () => {
    const amount = 137n;
    const sessions = [ps(10n), ps(10n), ps(10n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(7n);
    expect([...res.distribution.entries()]).toEqual([
      [sessions[0], 50n],
      [sessions[1], 40n],
      [sessions[2], 40n],
    ]);
  });

  it('should handle distribution with large minSendAmounts', () => {
    const amount = 11000n;
    const sessions = [ps(1000n), ps(2000n), ps(3000n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(0n);
    expect([...res.distribution.entries()]).toEqual([
      [sessions[0], 4000n],
      [sessions[1], 4000n],
      [sessions[2], 3000n],
    ]);
  });

  // This one is kept to keep for soundness of the test, but is not needed
  // https://github.com/interledger/web-monetization-extension/issues/1071
  it('should handle distribution with a very small amount', () => {
    const amount = 5n;
    const sessions = [ps(10n), ps(20n), ps(30n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(5n);
    expect([...res.distribution.entries()]).toEqual([]);
  });

  it('should distribute amount with sessions having varying minSendAmounts', () => {
    const amount = 280n;
    const sessions = [ps(7n), ps(13n), ps(23n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(6n);
    expect([...res.distribution.entries()]).toEqual([
      [sessions[0], 91n],
      [sessions[1], 91n],
      [sessions[2], 92n],
    ]);
  });

  it('should distribute amount with sessions having varying minSendAmounts #2', () => {
    const amount = 127n;
    const sessions = [ps(7n), ps(13n), ps(23n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(3n);
    expect([...res.distribution.entries()]).toEqual([
      [sessions[0], 49n],
      [sessions[1], 52n],
      [sessions[2], 23n],
    ]);
  });

  it('should handle distribution with an exact multiple of minSendAmounts', () => {
    const amount = 90n;
    const sessions = [ps(5n), ps(10n), ps(15n)];

    const res = distributeAmount(amount, sessions);
    expect(res.remainingAmount).toBe(0n);
    expect(res.distribution).toEqual(
      new Map([
        [sessions[0], 30n],
        [sessions[1], 30n],
        [sessions[2], 30n],
      ]),
    );
  });
});
