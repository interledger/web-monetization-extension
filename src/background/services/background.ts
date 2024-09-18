import type { Browser } from 'webextension-polyfill';
import type { ToBackgroundMessage } from '@/shared/messages';
import {
  failure,
  getNextOccurrence,
  getWalletInformation,
  success,
} from '@/shared/helpers';
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client/error';
import { getTab, OPEN_PAYMENTS_ERRORS } from '@/background/utils';
import { PERMISSION_HOSTS } from '@/shared/defines';
import type { Cradle } from '@/background/container';

type AlarmCallback = Parameters<Browser['alarms']['onAlarm']['addListener']>[0];
const ALARM_RESET_OUT_OF_FUNDS = 'reset-out-of-funds';

export class Background {
  private browser: Cradle['browser'];
  private openPaymentsService: Cradle['openPaymentsService'];
  private monetizationService: Cradle['monetizationService'];
  private storage: Cradle['storage'];
  private logger: Cradle['logger'];
  private tabEvents: Cradle['tabEvents'];
  private windowState: Cradle['windowState'];
  private sendToPopup: Cradle['sendToPopup'];
  private events: Cradle['events'];
  private heartbeat: Cradle['heartbeat'];

  constructor({
    browser,
    openPaymentsService,
    monetizationService,
    storage,
    logger,
    tabEvents,
    windowState,
    sendToPopup,
    events,
    heartbeat,
  }: Cradle) {
    Object.assign(this, {
      browser,
      openPaymentsService,
      monetizationService,
      storage,
      sendToPopup,
      tabEvents,
      windowState,
      logger,
      events,
      heartbeat,
    });
  }

  async start() {
    this.bindOnInstalled();
    await this.injectPolyfill();
    await this.onStart();
    this.heartbeat.start();
    this.bindMessageHandler();
    this.bindPermissionsHandler();
    this.bindEventsHandler();
    this.bindTabHandlers();
    this.bindWindowHandlers();
    this.sendToPopup.start();
  }

  // TODO: When Firefox 128 is old enough, inject directly via manifest.
  // Also see: injectPolyfill in contentScript
  // See: https://github.com/interledger/web-monetization-extension/issues/607
  async injectPolyfill() {
    try {
      await this.browser.scripting.registerContentScripts([
        {
          world: 'MAIN',
          id: 'polyfill',
          allFrames: true,
          js: ['polyfill/polyfill.js'],
          matches: PERMISSION_HOSTS.origins,
          runAt: 'document_start',
        },
      ]);
    } catch (error) {
      // Firefox <128 will throw saying world: MAIN isn't supported. So, we'll
      // inject via contentScript later. Injection via contentScript is slow,
      // but apart from WM detection on page-load, everything else works fine.
      if (!error.message.includes(`world`)) {
        this.logger.error(
          `Content script execution world \`MAIN\` not supported by your browser.\n` +
            `Check https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/ExecutionWorld#browser_compatibility for browser compatibility.`,
          error,
        );
      }
    }
  }

  async onStart() {
    const activeWindow = await this.browser.windows.getLastFocused();
    if (activeWindow.id) {
      this.windowState.setCurrentWindowId(activeWindow.id);
    }
    await this.storage.populate();
    await this.checkPermissions();
    await this.scheduleResetOutOfFundsState();
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

  bindWindowHandlers() {
    this.browser.windows.onFocusChanged.addListener(async () => {
      const windows = await this.browser.windows.getAll({
        windowTypes: ['normal', 'panel', 'popup'],
      });
      for (const window of windows) {
        const windowId = window.id!;
        const tabId = this.windowState.getCurrentTabId();
        if (!tabId) return;

        if (window.focused) {
          this.windowState.setCurrentWindowId(windowId);
          if (this.sendToPopup.isPopupOpen) {
            // This is intentionally called after windows.getAll, to add a little
            // delay for popup port to open
            this.logger.debug('Popup is open, ignoring focus change');
            return;
          }
          this.logger.debug(
            `[focus change] resume monetization for window=${windowId}, tabId=${tabId}`,
          );
          void this.monetizationService.resumePaymentSessionsByTabId(tabId);
          void this.updateVisualIndicatorsForCurrentTab();
        } else {
          this.logger.debug(
            `[focus change] stop monetization for window=${windowId}, tabId=${tabId}`,
          );
          void this.monetizationService.stopPaymentSessionsByTabId(tabId);
        }
      }
    });

    this.browser.windows.onRemoved.addListener(
      this.windowState.onWindowRemoved,
    );
  }

  bindTabHandlers() {
    this.browser.tabs.onRemoved.addListener(this.tabEvents.onRemovedTab);
    this.browser.tabs.onUpdated.addListener(this.tabEvents.onUpdatedTab);
    this.browser.tabs.onCreated.addListener(this.tabEvents.onCreatedTab);
    this.browser.tabs.onActivated.addListener(this.tabEvents.onActivatedTab);
  }

  bindMessageHandler() {
    this.browser.runtime.onMessage.addListener(
      async (message: ToBackgroundMessage, sender) => {
        this.logger.debug('Received message', message);
        try {
          switch (message.action) {
            // region Popup
            case 'GET_CONTEXT_DATA':
              return success(
                await this.monetizationService.getPopupData(
                  await this.windowState.getCurrentTab(),
                ),
              );

            case 'CONNECT_WALLET':
              await this.openPaymentsService.connectWallet(message.payload);
              if (message.payload.recurring) {
                this.scheduleResetOutOfFundsState();
              }
              return;

            case 'RECONNECT_WALLET': {
              await this.openPaymentsService.reconnectWallet();
              await this.monetizationService.resumePaymentSessionActiveTab();
              await this.updateVisualIndicatorsForCurrentTab();
              return success(undefined);
            }

            case 'ADD_FUNDS':
              await this.openPaymentsService.addFunds(message.payload);
              await this.browser.alarms.clear(ALARM_RESET_OUT_OF_FUNDS);
              if (message.payload.recurring) {
                this.scheduleResetOutOfFundsState();
              }
              return;

            case 'DISCONNECT_WALLET':
              await this.openPaymentsService.disconnectWallet();
              await this.browser.alarms.clear(ALARM_RESET_OUT_OF_FUNDS);
              await this.updateVisualIndicatorsForCurrentTab();
              this.sendToPopup.send('SET_STATE', { state: {}, prevState: {} });
              return;

            case 'TOGGLE_WM': {
              await this.monetizationService.toggleWM();
              await this.updateVisualIndicatorsForCurrentTab();
              return;
            }

            case 'UPDATE_RATE_OF_PAY':
              return success(
                await this.storage.updateRate(message.payload.rateOfPay),
              );

            case 'PAY_WEBSITE':
              return success(
                await this.monetizationService.pay(message.payload.amount),
              );

            // endregion

            // region Content
            case 'GET_WALLET_ADDRESS_INFO':
              return success(
                await getWalletInformation(message.payload.walletAddressUrl),
              );

            case 'TAB_FOCUSED':
              await this.tabEvents.onFocussedTab(getTab(sender));
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

            default:
              return;
          }
        } catch (e) {
          if (e instanceof OpenPaymentsClientError) {
            this.logger.error(message.action, e.message, e.description);
            return failure(
              OPEN_PAYMENTS_ERRORS[e.description] ?? e.description,
            );
          }
          this.logger.error(message.action, e.message);
          return failure(e.message);
        }
      },
    );
  }

  private async updateVisualIndicatorsForCurrentTab() {
    const activeTab = await this.windowState.getCurrentTab();
    if (activeTab?.id) {
      void this.tabEvents.updateVisualIndicators(activeTab.id, activeTab.url);
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
    });

    this.events.on('monetization.state_update', async (tabId) => {
      const tab = await this.browser.tabs.get(tabId);
      void this.tabEvents.updateVisualIndicators(tabId, tab?.url);
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
        await this.openPaymentsService.generateKeys();
      } else if (details.reason === 'update') {
        const migrated = await this.storage.migrate();
        if (migrated) {
          const prevVersion = data.version ?? 1;
          this.logger.info(
            `Migrated from ${prevVersion} to ${migrated.version}`,
          );
        }
      }
    });
  }

  checkPermissions = async () => {
    try {
      this.logger.debug('checking hosts permission');
      const hasPermissions =
        await this.browser.permissions.contains(PERMISSION_HOSTS);
      this.storage.setState({ missing_host_permissions: !hasPermissions });
    } catch (error) {
      this.logger.error(error);
    }
  };
}
