import type { Runtime, Tabs } from 'webextension-polyfill';
import type {
  PayWebsitePayload,
  PayWebsiteResponse,
  ResumeMonetizationPayload,
  StartMonetizationPayload,
  StopMonetizationPayload,
} from '@/shared/messages';
import { getSender, getTabId } from '@/background/utils';
import { OUTGOING_PAYMENT_POLLING_MAX_DURATION } from '@/background/config';
import {
  ErrorWithKey,
  isOkState,
  removeQueryParams,
  transformBalance,
} from '@/shared/helpers';
import type { PopupStore, Storage } from '@/shared/types';
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
  private PaymentSession: Cradle['PaymentSession'];
  private PaymentManager: Cradle['PaymentManager'];

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
    PaymentSession,
    PaymentManager,
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
      PaymentSession,
      PaymentManager,
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
      rateOfPay,
      connected,
      walletAddress: connectedWallet,
    } = await this.storage.get(['connected', 'rateOfPay', 'walletAddress']);

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
      paymentManager = new this.PaymentManager(
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
          PaymentSession: this.PaymentSession,
        },
      );
      this.tabState.paymentManagers.set(tabId, paymentManager);
    }

    await Promise.all(
      payload.map(({ requestId, walletAddress: receiver }) => {
        return paymentManager.addSession(frameId, requestId, receiver, true);
      }),
    );

    const { state, continuousPaymentsEnabled, enabled } =
      await this.storage.get(['state', 'continuousPaymentsEnabled', 'enabled']);
    if (
      enabled &&
      continuousPaymentsEnabled &&
      this.canTryPayment(connected, state)
    ) {
      paymentManager.start();
    } else {
      paymentManager.pause('cannot-start-yet');
    }

    this.events.emit('monetization.state_update', tabId);
  }

  async pausePaymentSessionsByTabId(tabId: number, reason?: string) {
    const paymentManager = this.tabState.paymentManagers.get(tabId);
    if (!paymentManager) {
      this.logger.debug(`No payment manager found for tab ${tabId}.`);
      return;
    }
    paymentManager.pause(reason);
  }

  async stopPaymentSession(
    payload: StopMonetizationPayload,
    sender: Runtime.MessageSender,
  ) {
    const tabId = getTabId(sender);
    const paymentManager = this.tabState.paymentManagers.get(tabId);
    if (!paymentManager) {
      this.logger.warn(`No payment manager found for tab ${tabId}.`);
      return;
    }

    let pausedCount = 0;
    for (const { requestId, intent } of payload) {
      if (intent === 'remove') {
        paymentManager.removeSession(requestId);
      } else if (intent === 'disable') {
        paymentManager.disableSession(requestId);
      } else {
        paymentManager.deactivateSession(requestId);
        pausedCount++;
      }
    }

    if (
      pausedCount > 0 &&
      !paymentManager.payableSessions.some((s) => s.active)
    ) {
      paymentManager.pause('all-paused');
    }

    this.events.emit('monetization.state_update', tabId);
  }

  async resumePaymentSession(
    payload: ResumeMonetizationPayload,
    sender: Runtime.MessageSender,
  ) {
    const tabId = getTabId(sender);
    const paymentManager = this.tabState.paymentManagers.get(tabId);

    if (!paymentManager) {
      this.logger.warn(`No payment manager found for tab ${tabId}.`);
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
      paymentManager.pause('paused-by-user');
      return;
    }

    paymentManager.resume();
  }

  async resumePaymentSessionsByTabId(tabId: number) {
    const paymentManager = this.tabState.paymentManagers.get(tabId);

    if (!paymentManager) {
      this.logger.debug(`No payment manager found for tab ${tabId}.`);
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

    paymentManager.resume();
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
      this.pauseAllSessions('toggle-continuous-payments');
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
      this.pauseAllSessions('toggle-payments');
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
        const paymentManager = this.tabState.paymentManagers.get(tabId);
        paymentManager?.setRate(rate);
      }
    });
  }

  private onKeyRevoked() {
    this.events.once('open_payments.key_revoked', async () => {
      this.logger.warn('Key revoked. Stopping all payment sessions.');
      this.pauseAllSessions();
      await this.storage.setState({ key_revoked: true });
      this.onKeyRevoked(); // setup listener again once all is done
    });
  }

  private onOutOfFunds() {
    this.events.once('open_payments.out_of_funds', async () => {
      this.logger.warn('Out of funds. Stopping all payment sessions.');
      this.pauseAllSessions();
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

  private pauseAllSessions(reason?: string) {
    for (const paymentManager of this.tabState.paymentManagers.values()) {
      paymentManager.pause(reason);
    }
    this.logger.debug('All payment sessions paused.');
  }

  async getPopupData(tab: Pick<Tabs.Tab, 'id' | 'url'>): Promise<PopupStore> {
    const storedData = await this.storage.get([
      'enabled',
      'continuousPaymentsEnabled',
      'connected',
      'state',
      'rateOfPay',
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
}
