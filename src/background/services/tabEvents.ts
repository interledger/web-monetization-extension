import { isOkState, removeQueryParams } from '@/shared/helpers';
import { ALLOWED_PROTOCOLS } from '@/shared/defines';
import type { Storage, TabId } from '@/shared/types';
import type { Browser } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';

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
};

type CallbackTab<T extends Extract<keyof Browser['tabs'], `on${string}`>> =
  Parameters<Browser['tabs'][T]['addListener']>[0];

export class TabEvents {
  private storage: Cradle['storage'];
  private tabState: Cradle['tabState'];
  private sendToPopup: Cradle['sendToPopup'];
  private t: Cradle['t'];
  private browser: Cradle['browser'];

  constructor({ storage, tabState, sendToPopup, t, browser }: Cradle) {
    Object.assign(this, {
      storage,
      tabState,
      sendToPopup,
      t,
      browser,
    });
  }

  onUpdatedTab: CallbackTab<'onUpdated'> = (tabId, changeInfo, tab) => {
    /**
     * if loading and no url -> clear all sessions but not the overpaying state
     * if loading and url -> we need to check if state keys include this url.
     */
    if (changeInfo.status === 'loading') {
      const url = tab.url ? removeQueryParams(tab.url) : '';
      const clearOverpaying = this.tabState.shouldClearOverpaying(tabId, url);

      this.tabState.clearSessionsByTabId(tabId);
      if (clearOverpaying) {
        this.tabState.clearOverpayingByTabId(tabId);
      }
      void this.updateVisualIndicators(tabId, url);
    }
  };

  onRemovedTab: CallbackTab<'onRemoved'> = (tabId, _removeInfo) => {
    this.tabState.clearSessionsByTabId(tabId);
    this.tabState.clearOverpayingByTabId(tabId);
  };

  onActivatedTab: CallbackTab<'onActivated'> = async (info) => {
    const tab = await this.browser.tabs.get(info.tabId);
    await this.updateVisualIndicators(info.tabId, tab?.url);
  };

  onCreatedTab: CallbackTab<'onCreated'> = async (tab) => {
    if (!tab.id) return;
    await this.updateVisualIndicators(tab.id, tab.url);
  };

  updateVisualIndicators = async (
    tabId: TabId,
    tabUrl?: string,
    isTabMonetized: boolean = tabId
      ? this.tabState.isTabMonetized(tabId)
      : false,
    hasTabAllSessionsInvalid: boolean = tabId
      ? this.tabState.tabHasAllSessionsInvalid(tabId)
      : false,
  ) => {
    const canMonetizeTab = ALLOWED_PROTOCOLS.some((scheme) =>
      tabUrl?.startsWith(scheme),
    );
    const { enabled, connected, state } = await this.storage.get([
      'enabled',
      'connected',
      'state',
    ]);
    const { path, title, isMonetized } = this.getIconAndTooltip({
      enabled,
      connected,
      state,
      canMonetizeTab,
      isTabMonetized,
      hasTabAllSessionsInvalid,
    });

    this.sendToPopup.send('SET_IS_MONETIZED', isMonetized);
    this.sendToPopup.send('SET_ALL_SESSIONS_INVALID', hasTabAllSessionsInvalid);
    await this.setIconAndTooltip(path, title, tabId);
  };

  // TODO: memoize this call
  private setIconAndTooltip = async (
    path: (typeof ICONS)[keyof typeof ICONS],
    title: string,
    tabId?: TabId,
  ) => {
    await this.browser.action.setIcon({ path, tabId });
    await this.browser.action.setTitle({ title, tabId });
  };

  private getIconAndTooltip({
    enabled,
    connected,
    state,
    canMonetizeTab,
    isTabMonetized,
    hasTabAllSessionsInvalid,
  }: {
    enabled: Storage['enabled'];
    connected: Storage['connected'];
    state: Storage['state'];
    canMonetizeTab: boolean;
    isTabMonetized: boolean;
    hasTabAllSessionsInvalid: boolean;
  }) {
    let title = this.t('appName');
    let iconData = ICONS.default;
    if (!connected || !canMonetizeTab) {
      // use defaults
    } else if (!isOkState(state) || hasTabAllSessionsInvalid) {
      iconData = enabled ? ICONS.enabled_warn : ICONS.disabled_warn;
      const tabStateText = this.t('icon_state_actionRequired');
      title = `${title} - ${tabStateText}`;
    } else {
      if (enabled) {
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

    return {
      path: iconData,
      isMonetized: isTabMonetized,
      title,
    };
  }
}
