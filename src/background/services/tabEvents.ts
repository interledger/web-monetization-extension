import { isOkState, removeQueryParams } from '@/shared/helpers';
import type { PopupTabInfo, Storage, TabId } from '@/shared/types';
import type { Browser, Runtime, Tabs } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';

type IconPath = Record<number, string>;
const ICONS = {
  default: {
    32: '/assets/icons/32x32/default.png',
    48: '/assets/icons/48x48/default.png',
    128: '/assets/icons/128x128/default.png',
  },
  default_gray: {
    32: '/assets/icons/32x32/default-gray.png',
    48: '/assets/icons/48x48/default-gray.png',
    128: '/assets/icons/128x128/default-gray.png',
  },
  enabled_hasLinks: {
    32: '/assets/icons/32x32/enabled-has-links.png',
    48: '/assets/icons/48x48/enabled-has-links.png',
    128: '/assets/icons/128x128/enabled-has-links.png',
  },
  enabled_noLinks: {
    32: '/assets/icons/32x32/enabled-no-links.png',
    48: '/assets/icons/48x48/enabled-no-links.png',
    128: '/assets/icons/128x128/enabled-no-links.png',
  },
  enabled_warn: {
    32: '/assets/icons/32x32/enabled-warn.png',
    48: '/assets/icons/48x48/enabled-warn.png',
    128: '/assets/icons/128x128/enabled-warn.png',
  },
  disabled_hasLinks: {
    32: '/assets/icons/32x32/disabled-has-links.png',
    48: '/assets/icons/48x48/disabled-has-links.png',
    128: '/assets/icons/128x128/disabled-has-links.png',
  },
  disabled_noLinks: {
    32: '/assets/icons/32x32/disabled-no-links.png',
    48: '/assets/icons/48x48/disabled-no-links.png',
    128: '/assets/icons/128x128/disabled-no-links.png',
  },
  disabled_warn: {
    32: '/assets/icons/32x32/disabled-warn.png',
    48: '/assets/icons/48x48/disabled-warn.png',
    128: '/assets/icons/128x128/disabled-warn.png',
  },
} satisfies Record<string, IconPath>;

type CallbackTab<T extends Extract<keyof Browser['tabs'], `on${string}`>> =
  Parameters<Browser['tabs'][T]['addListener']>[0];

export class TabEvents {
  private storage: Cradle['storage'];
  private tabState: Cradle['tabState'];
  private windowState: Cradle['windowState'];
  private sendToPopup: Cradle['sendToPopup'];
  private t: Cradle['t'];
  private browser: Cradle['browser'];
  private appName: Cradle['appName'];
  private browserName: Cradle['browserName'];

  constructor({
    storage,
    tabState,
    windowState,
    sendToPopup,
    t,
    browser,
    appName,
    browserName,
  }: Cradle) {
    Object.assign(this, {
      storage,
      tabState,
      windowState,
      sendToPopup,
      t,
      browser,
      appName,
      browserName,
    });
  }

  onUpdatedTab: CallbackTab<'onUpdated'> = (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && changeInfo.url) {
      const existingTabUrl = this.tabState.url.get(tabId);
      this.tabState.url.set(tabId, changeInfo.url);

      const url = removeQueryParams(changeInfo.url);
      if (!existingTabUrl || removeQueryParams(existingTabUrl) !== url) {
        // Navigating to new URL. Clear overpaying state if any.
        this.tabState.clearSessionsByTabId(tabId); // for sanity
        this.tabState.clearOverpayingByTabId(tabId);
      } else {
        // see onPageHide below
      }

      void this.updateVisualIndicators(tab);
    }
  };

  onRemovedTab: CallbackTab<'onRemoved'> = (tabId, info) => {
    this.windowState.removeTab(tabId, info.windowId);
    this.tabState.clearSessionsByTabId(tabId);
    this.tabState.clearOverpayingByTabId(tabId);
    this.tabState.url.delete(tabId);
  };

  onActivatedTab: CallbackTab<'onActivated'> = async (info) => {
    this.windowState.addTab(info.tabId, info.windowId);
    const updated = this.windowState.setCurrentTabId(info.windowId, info.tabId);
    if (!updated) return;
    const tab = await this.browser.tabs.get(info.tabId);
    await this.updateVisualIndicators(tab);
  };

  onCreatedTab: CallbackTab<'onCreated'> = async (tab) => {
    if (!tab.id) return;
    this.windowState.addTab(tab.id, tab.windowId);
    await this.updateVisualIndicators(tab);
  };

  onFocussedTab = async (tab: Tabs.Tab) => {
    if (!tab.id) return;
    this.windowState.addTab(tab.id, tab.windowId);
    const updated = this.windowState.setCurrentTabId(tab.windowId!, tab.id);
    if (!updated) return;
    await this.updateVisualIndicators(tab);
  };

  // In Chrome, we cannot rely on `onUpdatedTab` to detect page refresh, as
  // `changeInfo.url` is unset during refreshes in Chrome. So, based on a
  // message from content script (top-frame), we detect page unload to clear
  // payment sessions/managers.
  onPageHide = async (sender: Runtime.MessageSender) => {
    const tabId = sender?.tab?.id;
    if (!tabId) return; // Firefox doesn't have sender.tab after tab close
    this.tabState.clearSessionsByTabId(tabId);
  };

  updateVisualIndicators = async (tab: Tabs.Tab) => {
    const tabInfo = this.tabState.getPopupTabData(tab);
    this.sendToPopup.send('SET_TAB_DATA', tabInfo);
    const { continuousPaymentsEnabled, enabled, connected, state } =
      await this.storage.get([
        'continuousPaymentsEnabled',
        'enabled',
        'connected',
        'state',
      ]);
    const { path, title } = this.getIconAndTooltip({
      continuousPaymentsEnabled,
      enabled,
      connected,
      state,
      tabInfo,
    });
    await this.setIconAndTooltip(tabInfo.tabId, path, title);
  };

  private setIconAndTooltip = async (
    tabId: TabId,
    icon: IconPath,
    title: string,
  ) => {
    await this.setIcon(tabId, icon);
    await this.browser.action.setTitle({ title, tabId });
  };

  private async setIcon(tabId: TabId, icon: IconPath) {
    if (this.browserName === 'edge') {
      // Edge has split-view, and if we specify a tabId, it will only set the
      // icon for the left-pane when split-view is open. So, we ignore the
      // tabId. As it's inefficient, we do it only for Edge.
      // We'd have set this for a windowId, but that's not supported in Edge/Chrome
      await this.browser.action.setIcon({ path: icon });
      return;
    }

    if (this.tabState.getIcon(tabId) !== icon) {
      this.tabState.setIcon(tabId, icon); // memoize
      await this.browser.action.setIcon({ path: icon, tabId });
    }
  }

  private getIconAndTooltip({
    continuousPaymentsEnabled,
    enabled,
    connected,
    state,
    tabInfo,
  }: {
    continuousPaymentsEnabled: Storage['continuousPaymentsEnabled'];
    enabled: Storage['enabled'];
    connected: Storage['connected'];
    state: Storage['state'];
    tabInfo: PopupTabInfo;
  }) {
    let title = this.appName;
    let iconData = ICONS.default;
    if (!connected) {
      // use defaults
    } else if (!enabled) {
      iconData = ICONS.default;
    } else if (!isOkState(state) || tabInfo.status === 'all_sessions_invalid') {
      iconData = continuousPaymentsEnabled
        ? ICONS.enabled_warn
        : ICONS.disabled_warn;
      const tabStateText = this.t('icon_state_actionRequired');
      title = `${title} - ${tabStateText}`;
    } else if (
      tabInfo.status !== 'monetized' &&
      tabInfo.status !== 'no_monetization_links'
    ) {
      // use defaults
    } else {
      const isTabMonetized = tabInfo.status === 'monetized';
      if (continuousPaymentsEnabled) {
        iconData = isTabMonetized
          ? ICONS.enabled_hasLinks
          : ICONS.enabled_noLinks;
      } else {
        iconData = isTabMonetized
          ? ICONS.disabled_hasLinks
          : ICONS.disabled_noLinks;
      }
      const tabStateText = isTabMonetized
        ? this.t('icon_state_monetizationActive')
        : this.t('icon_state_monetizationInactive');
      title = `${title} - ${tabStateText}`;
    }

    return { path: iconData, title };
  }
}
