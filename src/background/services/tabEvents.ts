import browser from 'webextension-polyfill'
import type { Browser, Runtime, Tabs } from 'webextension-polyfill'
import { MonetizationService } from './monetization'
import { StorageService } from './storage'
import { IsTabMonetizedPayload } from '@/shared/messages'
import { getTabId } from '../utils'
import type { Translation } from '@/shared/helpers'

const runtime = browser.runtime
const ICONS = {
  default: {
    34: runtime.getURL('assets/icons/icon-34.png'),
    128: runtime.getURL('assets/icons/icon-128.png')
  },
  active: {
    34: runtime.getURL('assets/icons/icon-active-34.png'),
    128: runtime.getURL('assets/icons/icon-active-128.png')
  },
  inactive: {
    34: runtime.getURL('assets/icons/icon-inactive-34.png'),
    128: runtime.getURL('assets/icons/icon-inactive-128.png')
  },
  warning: {
    34: runtime.getURL('assets/icons/icon-warning-34.png'),
    128: runtime.getURL('assets/icons/icon-warning-128.png')
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
    const iconData = enabled ? ICONS.default : ICONS.warning
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
    const { enabled } = await this.storage.get(['enabled'])

    let title = this.t('appName')
    let iconData = enabled ? ICONS.default : ICONS.warning
    if (enabled && payload) {
      const { value: isTabMonetized } = payload
      iconData = isTabMonetized ? ICONS.active : ICONS.inactive
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
