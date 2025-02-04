import type { Tabs } from 'webextension-polyfill';
import type { MonetizationEventDetails } from '@/shared/messages';
import type { PopupTabInfo, TabId } from '@/shared/types';
import type { PaymentSession } from './paymentSession';
import type { Cradle } from '@/background/container';
import { removeQueryParams } from '@/shared/helpers';
import { ALLOWED_PROTOCOLS } from '@/shared/defines';
import { isBrowserInternalPage, isBrowserNewTabPage } from '@/background/utils';

type State = {
  monetizationEvent: MonetizationEventDetails;
  lastPaymentTimestamp: number;
  expiresAtTimestamp: number;
};

interface SaveOverpayingDetails {
  walletAddressId: string;
  monetizationEvent: MonetizationEventDetails;
  intervalInMs: number;
}

type SessionId = string;

export class TabState {
  private logger: Cradle['logger'];

  private state = new Map<TabId, Map<string, State>>();
  private sessions = new Map<TabId, Map<SessionId, PaymentSession>>();
  private urlMap = new Map<TabId, string>();
  private currentIcon = new Map<TabId, Record<number, string>>();

  constructor({ logger }: Cradle) {
    Object.assign(this, {
      logger,
    });
  }

  private getOverpayingStateKey(url: string, walletAddressId: string): string {
    return `${url}:${walletAddressId}`;
  }

  shouldClearOverpaying(tabId: TabId, url: string): boolean {
    const tabState = this.state.get(tabId);
    if (!tabState?.size || !url) return false;
    return ![...tabState.keys()].some((key) => key.startsWith(`${url}:`));
  }

  getOverpayingDetails(
    tabId: TabId,
    url: string,
    walletAddressId: string,
  ): { waitTime: number; monetizationEvent?: MonetizationEventDetails } {
    const key = this.getOverpayingStateKey(url, walletAddressId);
    const state = this.state.get(tabId)?.get(key);
    const now = Date.now();

    if (state && state.expiresAtTimestamp > now) {
      return {
        waitTime: state.expiresAtTimestamp - now,
        monetizationEvent: state.monetizationEvent,
      };
    }

    return {
      waitTime: 0,
    };
  }

  saveOverpaying(
    tabId: TabId,
    url: string,
    details: SaveOverpayingDetails,
  ): void {
    const { intervalInMs, walletAddressId, monetizationEvent } = details;
    if (!intervalInMs) return;

    const now = Date.now();
    const expiresAtTimestamp = now + intervalInMs;

    const key = this.getOverpayingStateKey(url, walletAddressId);
    const state = this.state.get(tabId)?.get(key);

    if (!state) {
      const tabState = this.state.get(tabId) || new Map<string, State>();
      tabState.set(key, {
        monetizationEvent,
        expiresAtTimestamp: expiresAtTimestamp,
        lastPaymentTimestamp: now,
      });
      this.state.set(tabId, tabState);
    } else {
      state.expiresAtTimestamp = expiresAtTimestamp;
      state.lastPaymentTimestamp = now;
    }
  }

  getSessions(tabId: TabId) {
    let sessions = this.sessions.get(tabId);
    if (!sessions) {
      sessions = new Map();
      this.sessions.set(tabId, sessions);
    }
    return sessions;
  }

  getEnabledSessions(tabId: TabId) {
    return [...this.getSessions(tabId).values()].filter((s) => !s.disabled);
  }

  getPayableSessions(tabId: TabId) {
    return this.getEnabledSessions(tabId).filter((s) => !s.invalid);
  }

  isTabMonetized(tabId: TabId) {
    return this.getEnabledSessions(tabId).length > 0;
  }

  tabHasAllSessionsInvalid(tabId: TabId) {
    const sessions = this.getEnabledSessions(tabId);
    return sessions.length > 0 && sessions.every((s) => s.invalid);
  }

  getAllSessions() {
    return [...this.sessions.values()].flatMap((s) => [...s.values()]);
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
    if (tabUrl && ALLOWED_PROTOCOLS.includes(tabUrl.protocol)) {
      // Do not include search params
      url = removeQueryParams(tabUrl.href);
    }

    let status: PopupTabInfo['status'] = 'no_monetization_links';
    if (!tabUrl) {
      status = 'unsupported_scheme';
    } else if (!ALLOWED_PROTOCOLS.includes(tabUrl.protocol)) {
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
    return [...this.sessions.keys()];
  }

  clearOverpayingByTabId(tabId: TabId) {
    this.state.delete(tabId);
    this.logger.debug(`Cleared overpaying state for tab ${tabId}.`);
  }

  clearSessionsByTabId(tabId: TabId) {
    this.currentIcon.delete(tabId);

    const sessions = this.getSessions(tabId);
    if (!sessions.size) return;

    for (const session of sessions.values()) {
      session.stop();
    }
    this.logger.debug(`Cleared ${sessions.size} sessions for tab ${tabId}.`);
    this.sessions.delete(tabId);
  }

  setUrl(tabId: TabId, url: string) {
    this.urlMap.set(tabId, url);
  }

  getUrl(tabId: TabId) {
    return this.urlMap.get(tabId);
  }

  clearUrl(tabId: TabId) {
    this.urlMap.delete(tabId);
  }
}
