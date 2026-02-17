import type { Browser, Runtime, Tabs } from 'webextension-polyfill';
import { BUILD_TARGET } from '@/shared/defines';
import { failure, success, type ToBackgroundMessage } from '@/shared/messages';
import {
  errorWithKeyToJSON,
  getNextOccurrence,
  getConnectWalletInfo,
  getWalletInformation,
  isErrorWithKey,
  moveToFront,
  CURRENT_DATA_CONSENT_VERSION,
  isConsentRequired,
} from '@/shared/helpers';
import { KeyAutoAddService } from '@/background/services/keyAutoAdd';
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client/error';
import { getTab, highlightTab, isSecureContext } from '@/background/utils';
import { APP_URL } from '@/background/constants';
import type { Cradle } from '@/background/container';
import type { AppStore, Tab } from '@/shared/types';

type AlarmCallback = Parameters<Browser['alarms']['onAlarm']['addListener']>[0];
const ALARM_RESET_OUT_OF_FUNDS = 'reset-out-of-funds';

export class Background {
  private browser: Cradle['browser'];
  private browserName: Cradle['browserName'];
  private walletService: Cradle['walletService'];
  private monetizationService: Cradle['monetizationService'];
  private storage: Cradle['storage'];
  private logger: Cradle['logger'];
  private tabState: Cradle['tabState'];
  private tabEvents: Cradle['tabEvents'];
  private windowState: Cradle['windowState'];
  private sendToPopup: Cradle['sendToPopup'];
  private sendToApp: Cradle['sendToApp'];
  private events: Cradle['events'];
  private heartbeat: Cradle['heartbeat'];
  private telemetry: Cradle['telemetry'];

  constructor({
    browser,
    browserName,
    walletService,
    monetizationService,
    storage,
    logger,
    tabState,
    tabEvents,
    windowState,
    sendToPopup,
    sendToApp,
    events,
    heartbeat,
    telemetry,
  }: Cradle) {
    Object.assign(this, {
      browser,
      browserName,
      walletService,
      monetizationService,
      storage,
      sendToPopup,
      sendToApp,
      tabState,
      tabEvents,
      windowState,
      logger,
      events,
      heartbeat,
      telemetry,
    });
  }

  async start() {
    this.logger.info('Background started');
    this.bindOnInstalled();
    this.bindMessageHandler();
    await this.onStart();
    this.heartbeat.start();
    void this.telemetry.start();
    this.bindPermissionsHandler();
    this.bindEventsHandler();
    this.bindTabHandlers();
    this.bindWindowHandlers();
    this.sendToPopup.start();
    this.sendToApp.start();
    await KeyAutoAddService.registerContentScripts({ browser: this.browser });
    // When the background restarts (e.g. after computer wake up), ask the
    // content script to resume monetization for active tab as the background no
    // longer has those sessions.
    await this.monetizationService
      .resumePaymentSessionActiveTab()
      .catch(() => {}); // if tabs not ready yet
  }

  async onStart() {
    if (this.browser.windows) {
      const activeWindow = await this.browser.windows.getLastFocused();
      if (activeWindow.id) {
        this.windowState.setCurrentWindowId(activeWindow.id);
      }
    } else {
      this.logger.warn('windows API not available');
      this.windowState.setCurrentWindowId(1);
    }
    await this.storage.populate();
    await this.checkPermissions();
    const { consent } = await this.storage.get(['consent']);
    if (isConsentRequired(consent)) {
      await this.storage.setState({ consent_required: true });
    }
    await this.scheduleResetOutOfFundsState();
    await this.updateVisualIndicatorsForCurrentTab().catch(() => {});
  }

  async scheduleResetOutOfFundsState() {
    // Reset out_of_funds state, we'll detect latest state as we make a payment.
    await this.storage.setState({ out_of_funds: false });

    const { recurringGrant } = await this.storage.get(['recurringGrant']);
    if (!recurringGrant) return;

    const renewDate = getNextOccurrence(recurringGrant.amount.interval);
    this.browser.alarms.create(ALARM_RESET_OUT_OF_FUNDS, {
      when: renewDate.valueOf(),
    });
    const resetOutOfFundsState: AlarmCallback = (alarm) => {
      if (alarm.name !== ALARM_RESET_OUT_OF_FUNDS) return;
      this.storage.setState({ out_of_funds: false });
      this.browser.alarms.onAlarm.removeListener(resetOutOfFundsState);
    };
    this.browser.alarms.onAlarm.addListener(resetOutOfFundsState);
  }

  async getAppData(): Promise<AppStore> {
    const { connected, publicKey, uid, consent, consentTelemetry } =
      await this.storage.get([
        'connected',
        'publicKey',
        'consent',
        'uid',
        'consentTelemetry',
      ]);

    return {
      uid,
      consent,
      consentTelemetry,
      connected,
      publicKey,
      transientState: this.storage.getPopupTransientState(),
    };
  }

  bindWindowHandlers() {
    if (!this.browser.windows) {
      this.logger.warn('windows API not available, skipping window handlers');
      return;
    }

    this.browser.windows.onCreated.addListener(
      this.windowState.onWindowCreated,
    );

    this.browser.windows.onRemoved.addListener(
      this.windowState.onWindowRemoved,
    );

    let popupOpen = false;
    this.browser.windows.onFocusChanged.addListener(async () => {
      const windows = await this.browser.windows.getAll({
        windowTypes: ['normal'],
      });
      const popupWasOpen = popupOpen;
      popupOpen = this.sendToPopup.isPortOpen;
      if (popupWasOpen || popupOpen) {
        // This is intentionally called after windows.getAll, to add a little
        // delay for popup port to open
        this.logger.debug('Popup is open, ignoring focus change');
        return;
      }
      for (const window of windows) {
        const windowId = window.id!;

        const tabIds = await this.windowState.getTabsForCurrentView(windowId);
        if (window.focused) {
          this.windowState.setCurrentWindowId(windowId);
          this.logger.info(
            `[focus change] resume monetization for window=${windowId}, tabIds=${JSON.stringify(tabIds)}`,
          );
          for (const tabId of tabIds) {
            await this.monetizationService.resumePaymentSessionsByTabId(tabId);
          }
          await this.updateVisualIndicatorsForCurrentTab();
        } else {
          if (!tabIds.length) continue;
          this.logger.info(
            `[focus change] pause monetization for window=${windowId}, tabIds=${JSON.stringify(tabIds)}`,
          );
          for (const tabId of tabIds) {
            void this.monetizationService.pausePaymentSessionsByTabId(
              tabId,
              'window-unfocussed',
            );
          }
        }
      }
    });
  }

  bindTabHandlers() {
    this.browser.tabs.onRemoved.addListener(this.tabEvents.onRemovedTab);
    this.browser.tabs.onUpdated.addListener(this.tabEvents.onUpdatedTab);
    this.browser.tabs.onCreated.addListener(this.tabEvents.onCreatedTab);
    this.browser.tabs.onActivated.addListener(this.tabEvents.onActivatedTab);
  }

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(this.onMessage);
  }

  // TODO: type ReturnType based on message
  onMessage = async (
    message: ToBackgroundMessage,
    sender: Runtime.MessageSender,
  ) => {
    this.logger.debug('Received message', message.action, message.payload);
    try {
      switch (message.action) {
        // region Popup
        case 'GET_DATA_POPUP': {
          const currentTab = await this.windowState.getCurrentTab();
          const data = await this.monetizationService.getPopupData(currentTab);
          return success(data);
        }

        case 'GET_CONNECT_WALLET_ADDRESS_INFO': {
          const connectWalletInfo = await getConnectWalletInfo(message.payload);
          return success(connectWalletInfo);
        }

        case 'CONNECT_WALLET': {
          await this.walletService.connectWallet(message.payload);
          if (message.payload?.recurring) {
            await this.scheduleResetOutOfFundsState();
          }
          return success(undefined);
        }

        case 'RESET_CONNECT_STATE': {
          this.walletService.resetConnectState();
          return success(undefined);
        }

        case 'RECONNECT_WALLET': {
          const lastActiveTab = await this.windowState.getCurrentTab();
          await this.walletService.reconnectWallet(message.payload);
          await this.refreshAllPaymentSessions(lastActiveTab);
          return success(undefined);
        }

        case 'UPDATE_BUDGET': {
          await this.walletService.updateBudget(message.payload);
          return success(undefined);
        }

        case 'ADD_FUNDS': {
          await this.walletService.addFunds(message.payload);
          await this.browser.alarms.clear(ALARM_RESET_OUT_OF_FUNDS);
          if (message.payload.recurring) {
            await this.scheduleResetOutOfFundsState();
          }
          return;
        }

        case 'DISCONNECT_WALLET': {
          await this.walletService.disconnectWallet(message.payload.force);
          this.tabState.clearAllState('disconnect');
          await this.browser.alarms.clear(ALARM_RESET_OUT_OF_FUNDS);
          await this.updateVisualIndicatorsForCurrentTab();
          this.sendToPopup.send('SET_STATE', { state: {}, prevState: {} });
          return success(undefined);
        }

        case 'TOGGLE_CONTINUOUS_PAYMENTS': {
          const nowEnabled =
            await this.monetizationService.toggleContinuousPayments();
          await this.updateVisualIndicatorsForCurrentTab();
          return success(nowEnabled);
        }

        case 'TOGGLE_PAYMENTS': {
          await this.monetizationService.togglePayments();
          await this.updateVisualIndicatorsForCurrentTab();
          return;
        }

        case 'UPDATE_RATE_OF_PAY': {
          await this.storage.updateRate(message.payload.rateOfPay);
          return success(undefined);
        }

        case 'PAY_WEBSITE': {
          const res = await this.monetizationService.pay(message.payload);
          return success(res);
        }

        case 'OPEN_APP': {
          await this.openAppPage(message.payload.path);
          return success(undefined);
        }

        case 'OPT_IN_OUT_TELEMETRY': {
          const { isOptedIn } = message.payload;
          await this.telemetry.optInOut(isOptedIn);
          return success(undefined);
        }

        // endregion

        // region Content
        case 'GET_WALLET_ADDRESS_INFO': {
          const walletInfo = await getWalletInformation(
            message.payload.walletAddressUrl,
          );
          return success(walletInfo);
        }

        case 'TAB_FOCUSED':
          await this.tabEvents.onFocussedTab(getTab(sender));
          return;

        case 'PAGE_HIDE':
          await this.tabEvents.onPageHide(sender);
          return;

        case 'START_MONETIZATION':
          await this.monetizationService.startPaymentSession(
            message.payload,
            sender,
          );
          return;

        case 'STOP_MONETIZATION':
          await this.monetizationService.stopPaymentSession(
            message.payload,
            sender,
          );
          return;

        case 'RESUME_MONETIZATION':
          await this.monetizationService.resumePaymentSession(
            message.payload,
            sender,
          );
          return;

        // endregion

        // region App
        case 'GET_DATA_APP':
          return success(await this.getAppData());

        case 'PROVIDE_CONSENT': {
          const { consentTelemetry } = message.payload;
          await this.storage.set({ consent: CURRENT_DATA_CONSENT_VERSION });
          await this.telemetry.optInOut(consentTelemetry);
          await this.storage.setState({ consent_required: false });
          return success(CURRENT_DATA_CONSENT_VERSION);
        }

        // endregion

        default:
          return;
      }
    } catch (e) {
      if (isErrorWithKey(e)) {
        this.logger.error(message.action, e);
        return failure(errorWithKeyToJSON(e));
      }
      if (e instanceof OpenPaymentsClientError) {
        this.logger.error(message.action, e.message, e.description);
        return failure(e.description);
      }
      this.logger.error(message.action, e.message);
      return failure(e.message);
    }
  };

  private async updateVisualIndicatorsForCurrentTab() {
    const activeTab = await this.windowState.getCurrentTab();
    if (activeTab?.id) {
      void this.tabEvents.updateVisualIndicators(activeTab);
    }
  }

  /**
   * Make sure sessions have a fresh incoming payment URL and minSendAmount
   * which we might have failed to get as the key was lost, or wallet
   * re-connected etc.
   *
   * @param priorityTab Prioritize this tab for the reset/restart process.
   */
  private async refreshAllPaymentSessions(priorityTab?: Tabs.Tab) {
    const paymentManagers = [...this.tabState.paymentManagers.values()];
    if (priorityTab?.id) {
      const priorityPM = this.tabState.paymentManagers.get(priorityTab.id);
      if (priorityPM) {
        moveToFront(paymentManagers, priorityPM);
      }
    }

    for (const paymentManager of paymentManagers) {
      await Promise.all(
        paymentManager.sessions.map((s) => s.findMinSendAmount(true)),
      );
    }

    if (priorityTab?.id) {
      if (priorityTab.id === this.windowState.getCurrentTabId()) {
        this.tabState.paymentManagers.get(priorityTab.id)?.resume();
      }
      await this.tabEvents.updateVisualIndicators(priorityTab);
    } else {
      await this.updateVisualIndicatorsForCurrentTab();
    }
  }

  bindPermissionsHandler() {
    this.browser.permissions.onAdded.addListener(this.checkPermissions);
    this.browser.permissions.onRemoved.addListener(this.checkPermissions);
  }

  bindEventsHandler() {
    this.events.on('storage.state_update', async ({ state, prevState }) => {
      this.sendToPopup.send('SET_STATE', { state, prevState });
      await this.updateVisualIndicatorsForCurrentTab();
      if (state.consent_required) {
        await this.openAppPage('/post-install/consent');
      }
    });

    this.events.on('monetization.state_update', async (tabId) => {
      const tab = await this.browser.tabs.get(tabId);
      void this.tabEvents.updateVisualIndicators(tab);
    });

    this.events.on('storage.popup_transient_state_update', (state) => {
      this.sendToPopup.send('SET_TRANSIENT_STATE', state);
      this.sendToApp.send('SET_TRANSIENT_STATE', state);
    });

    this.events.on('request_popup_close', () => {
      this.sendToPopup.send('CLOSE_POPUP', undefined);
    });

    this.events.on('storage.balance_update', (balance) =>
      this.sendToPopup.send('SET_BALANCE', balance),
    );
  }

  bindOnInstalled() {
    this.browser.runtime.onInstalled.addListener(async (details) => {
      const data = await this.storage.get();
      this.logger.info(data);
      if (details.reason === 'install') {
        await this.storage.populate();
        await this.walletService.generateKeys();
        await this.browser.tabs.create({
          url: this.browser.runtime.getURL(`${APP_URL}#/post-install`),
        });
      } else if (details.reason === 'update') {
        const migrated = await this.storage.migrate();
        if (migrated) {
          const prevVersion = data.version ?? 1;
          this.logger.info(
            `Migrated from ${prevVersion} to ${migrated.version}`,
          );
        }
      }
      await this.notifyWebsitesExtensionInstall();
      if (isConsentRequired(data.consent)) {
        await this.storage.setState({ consent_required: true });
      }
    });
  }

  /**
   * Firefox, Safari inject script to existing tabs on install.
   *
   * For others (mainly Chromium based ones) inject the polyfill manually so
   * websites can detect extension installation (AKA, WM now supported).
   */
  private async notifyWebsitesExtensionInstall() {
    if (BUILD_TARGET === 'firefox' || BUILD_TARGET === 'safari') {
      return;
    }

    const allTabs = await this.browser.tabs.query({});
    const tabs = allTabs.filter((t) => t.id && t.url && isSecureContext(t.url));
    const injectPolyfill = (tab: Tab) => {
      return this.browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['polyfill/polyfill.js'],
        world: 'MAIN',
        injectImmediately: true,
      });
    };
    const result = await Promise.allSettled(tabs.map(injectPolyfill));
    const injectedCount = result.filter((r) => r.status === 'fulfilled').length;
    this.logger.log(
      `injected polyfill to ${injectedCount}/${tabs.length} existing tabs`,
    );
  }

  checkPermissions = async () => {
    try {
      this.logger.debug('checking hosts permission');
      const hasPermissions = await this.browser.permissions.contains({
        origins: this.browser.runtime.getManifest().host_permissions,
      });
      this.storage.setState({ missing_host_permissions: !hasPermissions });
    } catch (error) {
      this.logger.error(error);
    }

    if (this.browserName === 'firefox') {
      try {
        this.logger.debug('checking data_collection_permissions');
        const hasPermissions = await this.browser.permissions.contains({
          data_collection: ['technicalAndInteraction'],
        });
        this.logger.debug('has data_collection_permissions?', hasPermissions);
        await this.telemetry.optInOut(hasPermissions);
      } catch (error) {
        this.logger.error(error);
      }
    }
  };

  async openAppPage(path: string) {
    const appUrl = this.browser.runtime.getURL(APP_URL);

    const allTabs = await this.browser.tabs.query({});
    const appTab = allTabs.find((t) => t.url?.startsWith(appUrl));

    const url = `${appUrl}#${path}`;
    if (appTab?.id) {
      await this.browser.tabs.update(appTab.id, { url });
      await this.sendToPopup.send('CLOSE_POPUP', undefined);
      await highlightTab(this.browser, appTab.id);
      return appTab;
    } else {
      return await this.browser.tabs.create({ url });
    }
  }
}
