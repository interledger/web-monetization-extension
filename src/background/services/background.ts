import type { Browser } from 'webextension-polyfill';
import type { ToBackgroundMessage } from '@/shared/messages';
import {
  errorWithKeyToJSON,
  failure,
  getNextOccurrence,
  getWalletInformation,
  isErrorWithKey,
  success,
} from '@/shared/helpers';
import { KeyAutoAddService } from '@/background/services/keyAutoAdd';
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client/error';
import { getTab } from '@/background/utils';
import { PERMISSION_HOSTS } from '@/shared/defines';
import { APP_URL } from '@/background/constants';
import type { Cradle } from '@/background/container';
import type { AppStore } from '@/shared/types';

type AlarmCallback = Parameters<Browser['alarms']['onAlarm']['addListener']>[0];
const ALARM_RESET_OUT_OF_FUNDS = 'reset-out-of-funds';

export class Background {
  private browser: Cradle['browser'];
  private walletService: Cradle['walletService'];
  private monetizationService: Cradle['monetizationService'];
  private storage: Cradle['storage'];
  private logger: Cradle['logger'];
  private tabEvents: Cradle['tabEvents'];
  private windowState: Cradle['windowState'];
  private sendToPopup: Cradle['sendToPopup'];
  private sendToApp: Cradle['sendToApp'];
  private events: Cradle['events'];
  private heartbeat: Cradle['heartbeat'];

  constructor({
    browser,
    walletService,
    monetizationService,
    storage,
    logger,
    tabEvents,
    windowState,
    sendToPopup,
    sendToApp,
    events,
    heartbeat,
  }: Cradle) {
    Object.assign(this, {
      browser,
      walletService,
      monetizationService,
      storage,
      sendToPopup,
      sendToApp,
      tabEvents,
      windowState,
      logger,
      events,
      heartbeat,
    });
  }

  async start() {
    this.bindOnInstalled();
    this.bindMessageHandler();
    await this.injectPolyfill();
    await this.onStart();
    // this.heartbeat.start();
    this.bindPermissionsHandler();
    this.bindEventsHandler();
    this.bindTabHandlers();
    this.bindWindowHandlers();
    this.sendToPopup.start();
    this.sendToApp.start();
    await KeyAutoAddService.registerContentScripts({ browser: this.browser });
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
      if (!error.message.includes('world')) {
        this.logger.error(
          'Content script execution world `MAIN` not supported by your browser.\n' +
            'Check https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/ExecutionWorld#browser_compatibility for browser compatibility.',
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

  async getAppData(): Promise<AppStore> {
    const { connected, publicKey } = await this.storage.get([
      'connected',
      'publicKey',
    ]);

    return {
      connected,
      publicKey,
      transientState: this.storage.getPopupTransientState(),
    };
  }

  bindWindowHandlers() {
    this.browser.windows.onCreated.addListener(
      this.windowState.onWindowCreated,
    );

    this.browser.windows.onRemoved.addListener(
      this.windowState.onWindowRemoved,
    );

    let popupOpen = false;
    this.browser.windows.onFocusChanged.addListener(async () => {
      return;
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
          this.logger.info(
            `[focus change] stop monetization for window=${windowId}, tabIds=${JSON.stringify(tabIds)}`,
          );
          for (const tabId of tabIds) {
            void this.monetizationService.stopPaymentSessionsByTabId(tabId);
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
    this.browser.runtime.onMessage.addListener(
      async (message: ToBackgroundMessage, sender) => {
        this.logger.debug('Received message', message);
        try {
          switch (message.action) {
            // region Popup
            case 'GET_DATA_POPUP':
              return success(
                await this.monetizationService.getPopupData(
                  await this.windowState.getCurrentTab(),
                ),
              );

            case 'CONNECT_WALLET': {
              await this.walletService.connectWallet(message.payload);
              if (message.payload?.recurring) {
                this.scheduleResetOutOfFundsState();
              }
              return success(undefined);
            }
            case 'RECONNECT_WALLET': {
              await this.walletService.reconnectWallet(message.payload);
              await this.monetizationService.resumePaymentSessionActiveTab();
              await this.updateVisualIndicatorsForCurrentTab();
              return success(undefined);
            }

            case 'UPDATE_BUDGET':
              await this.walletService.updateBudget(message.payload);
              return success(undefined);

            case 'ADD_FUNDS':
              await this.walletService.addFunds(message.payload);
              await this.browser.alarms.clear(ALARM_RESET_OUT_OF_FUNDS);
              if (message.payload.recurring) {
                this.scheduleResetOutOfFundsState();
              }
              return;

            case 'DISCONNECT_WALLET':
              await this.walletService.disconnectWallet();
              await this.browser.alarms.clear(ALARM_RESET_OUT_OF_FUNDS);
              await this.updateVisualIndicatorsForCurrentTab();
              this.sendToPopup.send('SET_STATE', { state: {}, prevState: {} });
              return;

            case 'TOGGLE_CONTINUOUS_PAYMENTS': {
              await this.monetizationService.toggleContinuousPayments();
              await this.updateVisualIndicatorsForCurrentTab();
              return;
            }

            case 'TOGGLE_PAYMENTS': {
              await this.monetizationService.togglePayments();
              await this.updateVisualIndicatorsForCurrentTab();
              return;
            }

            case 'UPDATE_RATE_OF_PAY':
              return success(
                await this.storage.updateRate(message.payload.rateOfPay),
              );

            case 'PAY_WEBSITE':
              return success(
                await this.monetizationService.pay(message.payload),
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

            // region App
            case 'GET_DATA_APP':
              return success(await this.getAppData());
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
      },
    );
  }

  private async updateVisualIndicatorsForCurrentTab() {
    const activeTab = await this.windowState.getCurrentTab();
    if (activeTab?.id) {
      void this.tabEvents.updateVisualIndicators(activeTab);
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
