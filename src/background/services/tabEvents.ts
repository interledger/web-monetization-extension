import browser from 'webextension-polyfill'
import type { Browser, Runtime, Tabs } from 'webextension-polyfill'
import { MonetizationService } from './monetization'
import { StorageService } from './storage'
import { IsTabMonetizedPayload } from '@/shared/messages'
import { getTabId } from '../utils'
import { isOkState, type Translation } from '@/shared/helpers'

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

export class TabEvents {
  constructor(
    private monetizationService: MonetizationService,
    private storage: StorageService,
    private t: Translation,
    private browser: Browser
  ) {}
  clearTabSessions = (
    tabId: number,
    changeInfo: Tabs.OnUpdatedChangeInfoType | Tabs.OnRemovedRemoveInfoType
  ) => {
    if (
      ('status' in changeInfo && changeInfo.status === 'loading') ||
      'isWindowClosing' in changeInfo
    ) {
      this.monetizationService.clearTabSessions(tabId)
    }
  }

  private changeIcon = async () => {
    const { enabled } = await this.storage.get(['enabled'])
    const iconData = enabled ? ICONS.default : ICONS.default_gray
    await this.browser.action.setIcon({ path: iconData })
  }

  onActivatedTab = async () => {
    await this.changeIcon()
  }

  onCreatedTab = async () => {
    await this.changeIcon()
  }

  onUpdatedTab = async (
    payload?: IsTabMonetizedPayload | null,
    sender?: Runtime.MessageSender
  ) => {
    const { enabled, state } = await this.storage.get(['enabled', 'state'])

    let title = this.t('appName')
    let iconData = ICONS.default
    if (!isOkState(state)) {
      iconData = enabled ? ICONS.enabled_warn : ICONS.disabled_warn
      const tabStateText = this.t('icon_state_actionRequired')
      title = `${title} - ${tabStateText}`
    } else if (payload) {
      const { value: isTabMonetized } = payload
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
    const tabId = sender && getTabId(sender)

    await this.browser.action.setIcon({ path: iconData, tabId })
    await this.browser.action.setTitle({ title, tabId })
  }
}
