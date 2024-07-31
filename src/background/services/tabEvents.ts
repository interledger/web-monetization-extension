import browser from 'webextension-polyfill'
import type { Browser, Runtime } from 'webextension-polyfill'
import { IsTabMonetizedPayload } from '@/shared/messages'
import { getTabId } from '../utils'
import {
  isOkState,
  removeQueryParams,
  type Translation
} from '@/shared/helpers'
import type {
  MonetizationService,
  SendToPopup,
  StorageService,
  TabState
} from '.'
import type { Storage, TabId } from '@/shared/types'

const runtime = browser.runtime
const ICONS = {
  default: {
    32: runtime.getURL('assets/icons/32x32/default.png'),
    48: runtime.getURL('assets/icons/48x48/default.png'),
    128: runtime.getURL('assets/icons/128x128/default.png')
  },
  default_gray: {
    32: runtime.getURL('assets/icons/32x32/default-gray.png'),
    48: runtime.getURL('assets/icons/48x48/default-gray.png'),
    128: runtime.getURL('assets/icons/128x128/default-gray.png')
  },
  enabled_hasLinks: {
    32: runtime.getURL('assets/icons/32x32/enabled-has-links.png'),
    48: runtime.getURL('assets/icons/48x48/enabled-has-links.png'),
    128: runtime.getURL('assets/icons/128x128/enabled-has-links.png')
  },
  enabled_noLinks: {
    32: runtime.getURL('assets/icons/32x32/enabled-no-links.png'),
    48: runtime.getURL('assets/icons/48x48/enabled-no-links.png'),
    128: runtime.getURL('assets/icons/128x128/enabled-no-links.png')
  },
  enabled_warn: {
    32: runtime.getURL('assets/icons/32x32/enabled-warn.png'),
    48: runtime.getURL('assets/icons/48x48/enabled-warn.png'),
    128: runtime.getURL('assets/icons/128x128/enabled-warn.png')
  },
  disabled_hasLinks: {
    32: runtime.getURL('assets/icons/32x32/disabled-has-links.png'),
    48: runtime.getURL('assets/icons/48x48/disabled-has-links.png'),
    128: runtime.getURL('assets/icons/128x128/disabled-has-links.png')
  },
  disabled_noLinks: {
    32: runtime.getURL('assets/icons/32x32/disabled-no-links.png'),
    48: runtime.getURL('assets/icons/48x48/disabled-no-links.png'),
    128: runtime.getURL('assets/icons/128x128/disabled-no-links.png')
  },
  disabled_warn: {
    32: runtime.getURL('assets/icons/32x32/disabled-warn.png'),
    48: runtime.getURL('assets/icons/48x48/disabled-warn.png'),
    128: runtime.getURL('assets/icons/128x128/disabled-warn.png')
  }
}

type CallbackTabOnActivated = Parameters<
  Browser['tabs']['onActivated']['addListener']
>[0]
type CallbackTabOnCreated = Parameters<
  Browser['tabs']['onCreated']['addListener']
>[0]
type CallbackTabOnRemoved = Parameters<
  Browser['tabs']['onRemoved']['addListener']
>[0]
type CallbackTabOnUpdated = Parameters<
  Browser['tabs']['onUpdated']['addListener']
>[0]

export class TabEvents {
  constructor(
    private monetizationService: MonetizationService,
    private storage: StorageService,
    private tabState: TabState,
    private sendToPopup: SendToPopup,
    private t: Translation,
    private browser: Browser
  ) {}

  onUpdatedTab: CallbackTabOnUpdated = (tabId, changeInfo) => {
    console.warn('clearTabSessions', changeInfo)

    /**
     * if loading and no url -> clear all sessions but not the overpaying state
     * if loading and url -> we need to check if state keys include this url.
     */
    if (changeInfo.status === 'loading') {
      const clearOverpaying = changeInfo.url
        ? this.tabState.checkOverpayingUrl(
            tabId,
            removeQueryParams(changeInfo.url)
          )
        : false
      console.log({ clearOverpaying, url: changeInfo.url })
      this.monetizationService.clearTabSessions(tabId, { clearOverpaying })
    }
  }

  onRemovedTab: CallbackTabOnRemoved = (tabId, _removeInfo) => {
    this.monetizationService.clearTabSessions(tabId, { clearOverpaying: true })
  }

  onActivatedTab: CallbackTabOnActivated = async (info) => {
    await this.updateVisualIndicators(info.tabId)
  }

  onCreatedTab: CallbackTabOnCreated = async (tab) => {
    await this.updateVisualIndicators(tab.id)
  }

  onUpdatedTabUpdatedIndicator = async (
    payload?: IsTabMonetizedPayload | null,
    sender?: Runtime.MessageSender
  ) => {
    const tabId = sender && getTabId(sender)
    await this.updateVisualIndicators(tabId, payload?.value)
  }

  private updateVisualIndicators = async (
    tabId?: TabId,
    isTabMonetized: boolean = tabId
      ? this.tabState.isTabMonetized(tabId)
      : false
  ) => {
    const { enabled, state } = await this.storage.get(['enabled', 'state'])
    const { path, title, isMonetized } = this.getIconAndTooltip({
      enabled,
      state,
      isTabMonetized
    })
    this.sendToPopup.send('SET_IS_MONETIZED', isMonetized)
    await this.setIconAndTooltip(path, title, tabId)
  }

  // TODO: memoize this call
  private setIconAndTooltip = async (
    path: (typeof ICONS)[keyof typeof ICONS],
    title: string,
    tabId?: TabId
  ) => {
    await this.browser.action.setIcon({ path, tabId })
    await this.browser.action.setTitle({ title, tabId })
  }

  private getIconAndTooltip({
    enabled,
    state,
    isTabMonetized
  }: {
    enabled: Storage['enabled']
    state: Storage['state']
    isTabMonetized: boolean
  }) {
    let title = this.t('appName')
    let iconData = ICONS.default
    if (!isOkState(state)) {
      iconData = enabled ? ICONS.enabled_warn : ICONS.disabled_warn
      const tabStateText = this.t('icon_state_actionRequired')
      title = `${title} - ${tabStateText}`
    } else {
      if (enabled) {
        iconData = isTabMonetized
          ? ICONS.enabled_hasLinks
          : ICONS.enabled_noLinks
      } else {
        iconData = isTabMonetized
          ? ICONS.disabled_hasLinks
          : ICONS.disabled_noLinks
      }
      const tabStateText = isTabMonetized
        ? this.t('icon_state_monetizationActive')
        : this.t('icon_state_monetizationInactive')
      title = `${title} - ${tabStateText}`
    }

    return {
      path: iconData,
      isMonetized: isTabMonetized,
      title
    }
  }
}
