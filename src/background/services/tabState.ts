import type { Tabs } from 'webextension-polyfill';
import type { MonetizationEventDetails } from '@/shared/messages';
import type { PopupTabInfo, TabId } from '@/shared/types';
import type { Cradle } from '@/background/container';
import type { PaymentManager } from './paymentManager';
import { removeQueryParams } from '@/shared/helpers';
import {
  isBrowserInternalPage,
  isBrowserNewTabPage,
  isSecureContext,
} from '@/background/utils';

interface SaveLastPaymentDetails {
  walletAddressId: string;
  monetizationEvent: MonetizationEventDetails;
}

interface State extends SaveLastPaymentDetails {
  ts: Date;
}

export class TabState {
  private logger: Cradle['logger'];

  private state = new Map<TabId, Map<string, State>>();
  private currentIcon = new Map<TabId, Record<number, string>>();
  public readonly url = new UrlMap();
  public readonly paymentManagers = new PaymentManagers();

  constructor({ logger }: Cradle) {
    Object.assign(this, {
      logger,
    });
  }

  getLastPaymentDetails(tabId: TabId, url: string): Readonly<State> | null {
    const state = this.state.get(tabId)?.get(url);
    return state ? { ...state } : null;
  }

  saveLastPaymentDetails(
    tabId: TabId,
    url: string,
    details: SaveLastPaymentDetails,
  ): void {
    const { walletAddressId, monetizationEvent } = details;

    const now = new Date();

    const state = this.state.get(tabId)?.get(url);

    if (!state) {
      const tabState = this.state.get(tabId) || new Map<string, State>();
      tabState.set(url, {
        walletAddressId,
        monetizationEvent,
        ts: now,
      });
      this.state.set(tabId, tabState);
    } else {
      state.ts = now;
    }
  }

  getEnabledSessions(tabId: TabId) {
    const paymentManager = this.paymentManagers.get(tabId);
    return paymentManager?.enabledSessions ?? [];
  }

  getPayableSessions(tabId: TabId) {
    const paymentManager = this.paymentManagers.get(tabId);
    return paymentManager?.payableSessions ?? [];
  }

  isTabMonetized(tabId: TabId) {
    return this.getEnabledSessions(tabId).length > 0;
  }

  tabHasAllSessionsInvalid(tabId: TabId) {
    const sessions = this.getEnabledSessions(tabId);
    return sessions.length > 0 && sessions.every((s) => s.invalid);
  }

  getAllSessions() {
    return [...this.paymentManagers.values()].flatMap((s) => s.sessions);
  }

  getPopupTabData(tab: Pick<Tabs.Tab, 'id' | 'url'>): PopupTabInfo {
    if (!tab.id) {
      throw new Error('Tab does not have an ID');
    }

    let tabUrl: URL | null = null;
    try {
      tabUrl = new URL(tab.url ?? '');
    } catch {
      // noop
    }

    let url = '';
    if (tabUrl && isSecureContext(tabUrl)) {
      // Do not include search params
      url = removeQueryParams(tabUrl.href);
    }

    let status: PopupTabInfo['status'] = 'no_monetization_links';
    if (!tabUrl) {
      status = 'unsupported_scheme';
    } else if (!isSecureContext(tabUrl)) {
      if (tabUrl && isBrowserInternalPage(tabUrl)) {
        if (isBrowserNewTabPage(tabUrl)) {
          status = 'new_tab';
        } else {
          status = 'internal_page';
        }
      } else {
        status = 'unsupported_scheme';
      }
    } else if (this.tabHasAllSessionsInvalid(tab.id)) {
      status = 'all_sessions_invalid';
    } else if (this.isTabMonetized(tab.id)) {
      status = 'monetized';
    }

    return { tabId: tab.id, url, status };
  }

  getIcon(tabId: TabId) {
    return this.currentIcon.get(tabId);
  }

  setIcon(tabId: TabId, icon: Record<number, string>) {
    this.currentIcon.set(tabId, icon);
  }

  getAllTabs(): TabId[] {
    return this.paymentManagers.tabIds;
  }

  clearOverpayingByTabId(tabId: TabId) {
    const cleared = this.state.delete(tabId);
    if (cleared) {
      this.logger.debug(`Cleared overpaying state for tab ${tabId}.`);
    }
  }

  clearSessionsByTabId(tabId: TabId) {
    this.currentIcon.delete(tabId);
    this.paymentManagers.destroy(tabId);
  }
}

class UrlMap {
  private map = new Map<TabId, string>();

  set(tabId: TabId, url: string) {
    this.map.set(tabId, url);
  }

  get(tabId: TabId) {
    return this.map.get(tabId);
  }

  delete(tabId: TabId) {
    this.map.delete(tabId);
  }
}

class PaymentManagers {
  private map = new Map<TabId, PaymentManager>();

  get(tabId: TabId) {
    return this.map.get(tabId);
  }

  set(tabId: TabId, paymentManager: PaymentManager) {
    this.map.set(tabId, paymentManager);
  }

  destroy(tabId: TabId) {
    const paymentManager = this.map.get(tabId);
    if (!paymentManager) {
      return false;
    }
    paymentManager.stop('destroy');
    return this.map.delete(tabId);
  }

  get tabIds() {
    return [...this.map.keys()];
  }

  values() {
    return this.map.values();
  }
}
