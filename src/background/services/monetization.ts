import type { Runtime, Tabs } from 'webextension-polyfill';
import type {
  PayWebsitePayload,
  PayWebsiteResponse,
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload,
} from '@/shared/messages';
import { PaymentManager } from './paymentManager';
import { computeRate, getSender, getTabId } from '@/background/utils';
import { OUTGOING_PAYMENT_POLLING_MAX_DURATION } from '@/background/config';
import {
  ErrorWithKey,
  isOkState,
  removeQueryParams,
  transformBalance,
} from '@/shared/helpers';
import type { AmountValue, PopupStore, Storage } from '@/shared/types';
import type { Cradle } from '@/background/container';

export class MonetizationService {
  private logger: Cradle['logger'];
  private rootLogger: Cradle['rootLogger'];
  // private t: Cradle['t'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private outgoingPaymentGrantService: Cradle['outgoingPaymentGrantService'];
  private storage: Cradle['storage'];
  private events: Cradle['events'];
  private tabState: Cradle['tabState'];
  private windowState: Cradle['windowState'];
  private message: Cradle['message'];

  constructor({
    logger,
    rootLogger,
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
      rootLogger,
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

    const { tabId, frameId, url: fullUrl } = getSender(sender);

    let paymentManager = this.tabState.paymentManagers.get(tabId);
    if (!paymentManager) {
      const url = removeQueryParams(this.tabState.url.get(tabId) || fullUrl!);
      paymentManager = new PaymentManager(
        tabId,
        url,
        connectedWallet,
        rateOfPay,
        {
          storage: this.storage,
          openPaymentsService: this.openPaymentsService,
          outgoingPaymentGrantService: this.outgoingPaymentGrantService,
          events: this.events,
          tabState: this.tabState,
          logger: this.rootLogger.getLogger(
            `payment-manager/${new URL(url).host}`,
          ),
          rootLogger: this.rootLogger,
          message: this.message,
        },
      );
      this.tabState.paymentManagers.set(tabId, paymentManager);
    }

    await Promise.all(
      payload.map(({ requestId, walletAddress: receiver }) => {
        return paymentManager.addSession(frameId, requestId, receiver, true);
      }),
    );
    this.events.emit('monetization.state_update', tabId);

    if (
      enabled &&
      continuousPaymentsEnabled &&
      this.canTryPayment(connected, state)
    ) {
      paymentManager.start();
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

    for (const { requestId, intent } of payload) {
      const session = sessions.get(requestId);
      if (!session) continue;

      if (intent === 'remove') {
        needsAdjustAmount = true;
        session.stop();
        sessions.delete(requestId);
      } else if (intent === 'disable') {
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
      // If there are no sessions and we got a resume call, treat it as a fresh
      // start call. The sessions could be cleared as:
      // - the background script/worker had terminated, so all sessions (stored
      //   in-memory) were cleared
      // - user hit back/forward button, so sessions for this tabId+URL were
      //   cleared (we clear sessions on URL change in `onUpdatedTab`).
      this.logger.info('setting up sessions & starting');
      await this.startPaymentSession(payload, sender);
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
      // If there are no sessions and we got a resume call, request content
      // script to get us the latest resume payload. The sessions could be
      // cleared as the background script/worker had terminated (for example,
      // computer went to sleep), so all sessions (stored in-memory) were
      // cleared.
      await this.message.sendToTab(
        tabId,
        undefined,
        'REQUEST_RESUME_MONETIZATION',
        null,
      );
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

    const paymentManager = this.tabState.paymentManagers.get(tab.id);
    if (!paymentManager) {
      throw new Error('Unexpected: no payment manager found for tab');
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

    const payableSessions = paymentManager.payableSessions;
    if (!payableSessions.length) {
      if (paymentManager.enabledSessions.length) {
        throw new ErrorWithKey('pay_error_invalidReceivers');
      }
      throw new ErrorWithKey('pay_error_notMonetized');
    }

    const signal = AbortSignal.timeout(OUTGOING_PAYMENT_POLLING_MAX_DURATION); // can use other signals as well, such as popup closed etc.
    const amountToSend = BigInt(
      (Number(amount) * 10 ** walletAddress.assetScale).toFixed(0),
    );
    const result = await paymentManager.pay(amountToSend, signal);

    const { sentAmount, debitAmount } = result.amounts;
    return {
      type: sentAmount < debitAmount ? 'partial' : 'full',
      sentAmount: transformBalance(sentAmount, walletAddress.assetScale),
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
