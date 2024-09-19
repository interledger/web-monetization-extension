import type { Browser } from 'webextension-polyfill';
import type { TabId, WindowId } from '@/shared/types';
import type { Cradle } from '@/background/container';
import { getCurrentActiveTab } from '@/background/utils';

type CallbackWindow<
  T extends Extract<keyof Browser['windows'], `on${string}`>,
> = Parameters<Browser['windows'][T]['addListener']>[0];

export class WindowState {
  private browser: Cradle['browser'];
  private message: Cradle['message'];

  private currentWindowId: WindowId;
  private currentTab = new Map<WindowId, TabId>();
  /**
   * In Edge's split view, `browser.tabs.query({ windowId })` doesn't return
   * all tabs. So, we maintain the set of tabs per window.
   */
  private tabs = new Map<WindowId, Set<TabId>>();

  constructor({ browser, message }: Cradle) {
    Object.assign(this, { browser, message });
  }

  setCurrentWindowId(windowId: WindowId) {
    if (this.currentWindowId === windowId) {
      return false;
    }
    this.currentWindowId = windowId;
    return true;
  }

  getCurrentWindowId() {
    return this.currentWindowId;
  }

  addTab(tabId: TabId, windowId: WindowId = this.getCurrentWindowId()) {
    const tabs = this.tabs.get(windowId);
    if (tabs) {
      const prevSize = tabs.size;
      tabs.add(tabId);
      return prevSize !== tabs.size;
    } else {
      this.tabs.set(windowId, new Set([tabId]));
      return true;
    }
  }

  removeTab(tabId: TabId, windowId: WindowId = this.getCurrentWindowId()) {
    return this.tabs.get(windowId)?.delete(tabId) ?? false;
  }

  getTabs(windowId: WindowId = this.getCurrentWindowId()): TabId[] {
    return Array.from(this.tabs.get(windowId) ?? []);
  }

  /**
   * Browsers like Edge, Vivaldi allow having multiple tabs in same "view". We
   * can use this data to resume/pause monetization for multiple tabs on window
   * focus change, not just the one active tab that browser APIs return.
   *
   * For given window, we store the set of tabs that are currently in view. We
   * only store per window, as we don't have anything like a view ID, and we
   * reset the view when new tab is opened or switched.
   */
  async getTabsForCurrentView(
    windowId: WindowId = this.getCurrentWindowId(),
  ): Promise<TabId[]> {
    const TOP_FRAME_ID = 0;
    const tabs = this.getTabs(windowId);
    const responses = await Promise.all(
      tabs.map((tabId) =>
        this.message
          .sendToTab(tabId, TOP_FRAME_ID, 'IS_TAB_IN_VIEW', undefined)
          .then((r) => (r.success ? r.payload : null)),
      ),
    );
    return tabs.filter((_, i) => responses[i]);
  }

  setCurrentTabId(windowId: WindowId, tabId: TabId) {
    const existing = this.getCurrentTabId(windowId);
    if (existing === tabId) return false;
    this.currentTab.set(windowId, tabId);
    return true;
  }

  getCurrentTabId(windowId: WindowId = this.getCurrentWindowId()) {
    return this.currentTab.get(windowId);
  }

  async getCurrentTab(windowId: WindowId = this.getCurrentWindowId()) {
    const tabId = this.getCurrentTabId(windowId);
    const tab = tabId
      ? await this.browser.tabs.get(tabId)
      : await getCurrentActiveTab(this.browser);
    return tab;
  }

  onWindowCreated: CallbackWindow<'onCreated'> = async (window) => {
    if (window.type && window.type !== 'normal') {
      return;
    }

    const prevWindowId = this.getCurrentWindowId();
    const prevTabId = this.getCurrentTabId(prevWindowId);
    // if the window was created with a tab (like move tab to new window),
    // remove tab from previous window
    if (prevWindowId && window.id !== prevWindowId) {
      if (prevTabId) {
        const tab = await this.browser.tabs.get(prevTabId);
        if (tab.windowId !== prevWindowId) {
          this.removeTab(prevTabId, prevWindowId);
        }
      }
    }
  };

  onWindowRemoved: CallbackWindow<'onRemoved'> = (windowId) => {
    this.currentTab.delete(windowId);
    this.tabs.delete(windowId);
  };
}
