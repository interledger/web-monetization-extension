import type { Runtime, Tabs } from 'webextension-polyfill';
import type {
  PayWebsitePayload,
  PayWebsiteResponse,
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload,
} from '@/shared/messages';
import { PaymentSession } from './paymentSession';
import { computeRate, getSender, getTabId } from '@/background/utils';
import { isOutOfBalanceError } from './openPayments';
import {
  OUTGOING_PAYMENT_POLLING_MAX_ATTEMPTS,
  OUTGOING_PAYMENT_POLLING_MAX_DURATION,
} from '@/background/config';
import {
  ErrorWithKey,
  formatCurrency,
  isErrorWithKey,
  isOkState,
  removeQueryParams,
  transformBalance,
} from '@/shared/helpers';
import type { AmountValue, PopupStore, Storage } from '@/shared/types';
import type { OutgoingPayment } from '@interledger/open-payments';
import type { Cradle } from '@/background/container';

export class MonetizationService {
  private logger: Cradle['logger'];
  private t: Cradle['t'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private storage: Cradle['storage'];
  private events: Cradle['events'];
  private tabState: Cradle['tabState'];
  private windowState: Cradle['windowState'];
  private message: Cradle['message'];

  constructor({
    logger,
    t,
    openPaymentsService,
    outgoingPaymentGrantService,
    storage,
    events,
    tabState,
    windowState,
    message,
  }: Cradle) {
    Object.assign(this, {
      logger,
      t,
      openPaymentsService,
      outgoingPaymentGrantService,
      storage,
      events,
      tabState,
      windowState,
      message,
    });

    this.registerEventListeners();
  }

  async startPaymentSession(
    payload: StartMonetizationPayload,
    sender: Runtime.MessageSender,
  ) {
    if (!payload.length) {
      throw new Error('Unexpected: payload is empty');
    }
    const {
      state,
      continuousPaymentsEnabled,
      enabled,
      rateOfPay,
      connected,
      walletAddress: connectedWallet,
    } = await this.storage.get([
      'state',
      'continuousPaymentsEnabled',
      'enabled',
      'connected',
      'rateOfPay',
      'walletAddress',
    ]);

    if (!rateOfPay || !connectedWallet) {
      this.logger.error(
        `Did not find rate of pay or connect wallet information. Received rate=${rateOfPay}, wallet=${connectedWallet}. Payment session will not be initialized.`,
      );
      return;
    }
    const { tabId, frameId, url } = getSender(sender);
    const sessions = this.tabState.getSessions(tabId);

    const replacedSessions = new Set<string>();

    // Initialize new sessions
    for (const p of payload) {
      const { requestId, walletAddress: receiver } = p;

      // Q: How does this impact client side apps/routing?
      const existingSession = sessions.get(requestId);
      if (existingSession) {
        existingSession.stop();
        sessions.delete(requestId);
        replacedSessions.add(requestId);
      }

      const session = new PaymentSession(
        receiver,
        connectedWallet,
        requestId,
        tabId,
        frameId,
        this.storage,
        this.openPaymentsService,
        this.outgoingPaymentGrantService,
        this.events,
        this.tabState,
        removeQueryParams(url!),
        this.logger,
        this.message,
      );

      sessions.set(requestId, session);
    }

    this.events.emit('monetization.state_update', tabId);

    const sessionsArr = this.tabState.getPayableSessions(tabId);
    if (!sessionsArr.length) return;
    const rate = computeRate(rateOfPay, sessionsArr.length);

    // Since we probe (through quoting) the debitAmount we have to await this call.
    const isAdjusted = await this.adjustSessionsAmount(sessionsArr, rate);
    if (!isAdjusted) return;

    if (
      enabled &&
      continuousPaymentsEnabled &&
      this.canTryPayment(connected, state)
    ) {
      for (const session of sessionsArr) {
        if (!sessions.get(session.id)) return;
        const source = replacedSessions.has(session.id)
          ? 'request-id-reused'
          : 'new-link';
        void session.start(source);
      }
    }
  }

  async stopPaymentSessionsByTabId(tabId: number) {
    const sessions = this.tabState.getSessions(tabId);
    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`);
      return;
    }

    for (const session of sessions.values()) {
      session.stop();
    }
  }

  async stopPaymentSession(
    payload: StopMonetizationPayload,
    sender: Runtime.MessageSender,
  ) {
    let needsAdjustAmount = false;
    const tabId = getTabId(sender);
    const sessions = this.tabState.getSessions(tabId);

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`);
      return;
    }

    for (const p of payload) {
      const { requestId } = p;

      const session = sessions.get(requestId);
      if (!session) return;

      if (p.intent === 'remove') {
        needsAdjustAmount = true;
        session.stop();
        sessions.delete(requestId);
      } else if (p.intent === 'disable') {
        needsAdjustAmount = true;
        session.disable();
      } else {
        session.stop();
      }
    }

    const { rateOfPay } = await this.storage.get(['rateOfPay']);
    if (!rateOfPay) return;

    if (needsAdjustAmount) {
      const sessionsArr = this.tabState.getPayableSessions(tabId);
      this.events.emit('monetization.state_update', tabId);
      if (!sessionsArr.length) return;
      const rate = computeRate(rateOfPay, sessionsArr.length);
      await this.adjustSessionsAmount(sessionsArr, rate).catch((e) => {
        this.logger.error(e);
      });
    }
  }

  async resumePaymentSession(
    payload: ResumeMonetizationPayload,
    sender: Runtime.MessageSender,
  ) {
    const tabId = getTabId(sender);
    const sessions = this.tabState.getSessions(tabId);

    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`);
      return;
    }

    const { state, connected, continuousPaymentsEnabled, enabled } =
      await this.storage.get([
        'state',
        'connected',
        'continuousPaymentsEnabled',
        'enabled',
      ]);
    if (
      !enabled ||
      !continuousPaymentsEnabled ||
      !this.canTryPayment(connected, state)
    ) {
      return;
    }

    for (const p of payload) {
      const { requestId } = p;
      sessions.get(requestId)?.resume();
    }
  }

  async resumePaymentSessionsByTabId(tabId: number) {
    const sessions = this.tabState.getSessions(tabId);
    if (!sessions.size) {
      this.logger.debug(`No active sessions found for tab ${tabId}.`);
      return;
    }

    const { state, connected, continuousPaymentsEnabled, enabled } =
      await this.storage.get([
        'state',
        'connected',
        'continuousPaymentsEnabled',
        'enabled',
      ]);
    if (
      !enabled ||
      !continuousPaymentsEnabled ||
      !this.canTryPayment(connected, state)
    ) {
      return;
    }

    for (const session of sessions.values()) {
      session.resume();
    }
  }

  async resumePaymentSessionActiveTab() {
    const currentTab = await this.windowState.getCurrentTab();
    if (!currentTab?.id) return;
    await this.resumePaymentSessionsByTabId(currentTab.id);
  }

  async toggleContinuousPayments() {
    const { continuousPaymentsEnabled, enabled } = await this.storage.get([
      'continuousPaymentsEnabled',
      'enabled',
    ]);
    const nowEnabled = !continuousPaymentsEnabled;
    await this.storage.set({ continuousPaymentsEnabled: nowEnabled });
    if (nowEnabled && enabled) {
      await this.resumePaymentSessionActiveTab();
    } else {
      this.stopAllSessions();
    }
  }

  async togglePayments() {
    const { continuousPaymentsEnabled, enabled } = await this.storage.get([
      'continuousPaymentsEnabled',
      'enabled',
    ]);
    const nowEnabled = !enabled;
    await this.storage.set({ enabled: nowEnabled });
    if (nowEnabled && continuousPaymentsEnabled) {
      await this.resumePaymentSessionActiveTab();
    } else {
      this.stopAllSessions();
    }
  }

  async pay({ amount }: PayWebsitePayload): Promise<PayWebsiteResponse> {
    const tab = await this.windowState.getCurrentTab();
    if (!tab || !tab.id) {
      throw new Error('Unexpected error: could not find active tab.');
    }

    const payableSessions = this.tabState.getPayableSessions(tab.id);
    if (!payableSessions.length) {
      if (this.tabState.getEnabledSessions(tab.id).length) {
        throw new Error(this.t('pay_error_invalidReceivers'));
      }
      throw new Error(this.t('pay_error_notMonetized'));
    }

    const { enabled, walletAddress } = await this.storage.get([
      'enabled',
      'walletAddress',
    ]);
    if (!enabled) {
      throw new Error('Unexpected: payments are not enabled');
    }
    if (!walletAddress) {
      throw new Error('Unexpected: wallet address not found.');
    }
    const { assetCode, assetScale } = walletAddress;

    const splitAmount = Number(amount) / payableSessions.length;
    // TODO: handle paying across two grants (when one grant doesn't have enough funds)
    const results = await Promise.allSettled(
      payableSessions.map((session) => session.pay(splitAmount)),
    );

    const outgoingPayments = new Map<string, OutgoingPayment | null>(
      payableSessions.map((s, i) => [
        s.id,
        results[i].status === 'fulfilled' ? results[i].value : null,
      ]),
    );
    this.logger.debug('polling outgoing payments for completion');
    const signal = AbortSignal.timeout(OUTGOING_PAYMENT_POLLING_MAX_DURATION); // can use other signals as well, such as popup closed etc.
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
            { signal, maxAttempts: OUTGOING_PAYMENT_POLLING_MAX_ATTEMPTS },
          )) {
            outgoingPayments.set(sessionId, outgoingPayment);
          }
          return outgoingPayments.get(sessionId);
        }),
    );

    const totalSentAmount = [...outgoingPayments.values()].reduce(
      (acc, op) => acc + BigInt(op?.sentAmount?.value ?? 0),
      0n,
    );
    const totalDebitAmount = [...outgoingPayments.values()].reduce(
      (acc, op) => acc + BigInt(op?.debitAmount?.value ?? 0),
      0n,
    );

    if (totalSentAmount === 0n) {
      const pollingErrors = pollingResults
        .filter((e) => e.status === 'rejected')
        .map((e) => e.reason);

      if (pollingErrors.some((e) => e.message === 'InsufficientGrant')) {
        this.logger.warn('Insufficient grant to read outgoing payments');
        // This permission request to read outgoing payments was added at a
        // later time, so existing connected wallets won't have this permission.
        // Assume as success for backward compatibility.
        const sentAmount = transformBalance(totalDebitAmount, assetScale);
        return {
          type: 'full',
          sentAmount: sentAmount,
          sentAmountFormatted: formatCurrency(sentAmount, assetCode),
        };
      }

      const isNotEnoughFunds = results
        .filter((e) => e.status === 'rejected')
        .some((e) => isOutOfBalanceError(e.reason));
      const isPollingLimitReached = pollingErrors.some(
        (err) =>
          (isErrorWithKey(err) &&
            err.key === 'pay_warn_outgoingPaymentPollingIncomplete') ||
          (err instanceof DOMException && err.name === 'TimeoutError'),
      );

      if (isNotEnoughFunds) {
        throw new ErrorWithKey('pay_error_notEnoughFunds');
      }
      if (isPollingLimitReached) {
        throw new ErrorWithKey('pay_warn_outgoingPaymentPollingIncomplete');
      }
      throw new ErrorWithKey('pay_error_general');
    }

    const sentAmount = transformBalance(totalSentAmount, assetScale);
    return {
      type: totalSentAmount < totalDebitAmount ? 'partial' : 'full',
      sentAmount: sentAmount,
      sentAmountFormatted: formatCurrency(sentAmount, assetCode),
    };
  }

  private canTryPayment(
    connected: Storage['connected'],
    state: Storage['state'],
  ): boolean {
    if (!connected) return false;
    if (isOkState(state)) return true;

    if (
      state.out_of_funds &&
      this.outgoingPaymentGrantService.isAnyGrantUsable
    ) {
      // if we're in out_of_funds state, we still try to make payments hoping we
      // have funds available now. If a payment succeeds, we move out from
      // of_out_funds state.
      return true;
    }

    return false;
  }

  private registerEventListeners() {
    this.onRateOfPayUpdate();
    this.onKeyRevoked();
    this.onOutOfFunds();
    this.onInvalidReceiver();
  }

  private onRateOfPayUpdate() {
    this.events.on('storage.rate_of_pay_update', async ({ rate }) => {
      this.logger.debug("Received event='storage.rate_of_pay_update'");
      const tabIds = this.tabState.getAllTabs();

      // Move the current active tab to the front of the array
      const currentTab = await this.windowState.getCurrentTab();
      if (currentTab?.id) {
        const idx = tabIds.indexOf(currentTab.id);
        if (idx !== -1) {
          const tmp = tabIds[0];
          tabIds[0] = currentTab.id;
          tabIds[idx] = tmp;
        }
      }

      for (const tabId of tabIds) {
        const sessions = this.tabState.getPayableSessions(tabId);
        if (!sessions.length) continue;
        const computedRate = computeRate(rate, sessions.length);
        await this.adjustSessionsAmount(sessions, computedRate).catch((e) => {
          this.logger.error(e);
        });
      }
    });
  }

  private onKeyRevoked() {
    this.events.once('open_payments.key_revoked', async () => {
      this.logger.warn('Key revoked. Stopping all payment sessions.');
      this.stopAllSessions();
      await this.storage.setState({ key_revoked: true });
      this.onKeyRevoked(); // setup listener again once all is done
    });
  }

  private onOutOfFunds() {
    this.events.once('open_payments.out_of_funds', async () => {
      this.logger.warn('Out of funds. Stopping all payment sessions.');
      this.stopAllSessions();
      await this.storage.setState({ out_of_funds: true });
      this.onOutOfFunds(); // setup listener again once all is done
    });
  }

  private onInvalidReceiver() {
    this.events.on('open_payments.invalid_receiver', async ({ tabId }) => {
      if (this.tabState.tabHasAllSessionsInvalid(tabId)) {
        this.logger.debug(`Tab ${tabId} has all sessions invalid`);
        this.events.emit('monetization.state_update', tabId);
      }
    });
  }

  private stopAllSessions() {
    for (const session of this.tabState.getAllSessions()) {
      session.stop();
    }
    this.logger.debug('All payment sessions stopped.');
  }

  async getPopupData(tab: Pick<Tabs.Tab, 'id' | 'url'>): Promise<PopupStore> {
    const storedData = await this.storage.get([
      'enabled',
      'continuousPaymentsEnabled',
      'connected',
      'state',
      'rateOfPay',
      'minRateOfPay',
      'maxRateOfPay',
      'walletAddress',
      'oneTimeGrant',
      'recurringGrant',
      'publicKey',
    ]);
    const balance = await this.storage.getBalance();

    const { oneTimeGrant, recurringGrant, ...dataFromStorage } = storedData;

    return {
      ...dataFromStorage,
      balance: balance.total.toString(),
      tab: this.tabState.getPopupTabData(tab),
      transientState: this.storage.getPopupTransientState(),
      grants: {
        oneTime: oneTimeGrant?.amount,
        recurring: recurringGrant?.amount,
      },
    };
  }

  private async adjustSessionsAmount(
    sessions: PaymentSession[],
    rate: AmountValue,
  ): Promise<boolean> {
    try {
      await Promise.all(sessions.map((session) => session.adjustAmount(rate)));
      return true;
    } catch (err) {
      if (err.name === 'AbortError') {
        this.logger.debug('adjustAmount aborted due to new call');
        return false;
      } else {
        throw err;
      }
    }
  }
}
