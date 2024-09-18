import type { TabId, WindowId } from '@/shared/types';
import type { Cradle } from '@/background/container';
import { getCurrentActiveTab } from '@/background/utils';

export class WindowState {
  private browser: Cradle['browser'];
  private currentWindowId: WindowId;
  private currentTab = new Map<WindowId, TabId>();

  constructor({ browser }: Cradle) {
    Object.assign(this, { browser });
  }

  setCurrentWindowId(windowId: WindowId) {
    this.currentWindowId = windowId;
  }

  getCurrentWindowId() {
    return this.currentWindowId;
  }

  setCurrentTabId(windowId: WindowId, tabId: TabId) {
    const existing = this.currentTab.get(windowId);
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

  onWindowRemoved = (windowId: WindowId) => {
    this.currentTab.delete(windowId);
  };
}
