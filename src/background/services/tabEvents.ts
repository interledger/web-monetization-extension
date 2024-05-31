import { type Browser, runtime, Tabs } from 'webextension-polyfill'
import { MonetizationService } from './monetization'
import { StorageService } from './storage'
import { IsTabMonetizedPayload } from '@/shared/messages'

const icon34 = runtime.getURL('assets/icons/icon-34.png')
const icon128 = runtime.getURL('assets/icons/icon-128.png')
const iconActive34 = runtime.getURL('assets/icons/icon-active-34.png')
const iconActive128 = runtime.getURL('assets/icons/icon-active-128.png')
const iconInactive34 = runtime.getURL('assets/icons/icon-inactive-34.png')
const iconInactive128 = runtime.getURL('assets/icons/icon-inactive-128.png')
const iconWarning34 = runtime.getURL('assets/icons/icon-warning-34.png')
const iconWarning128 = runtime.getURL('assets/icons/icon-warning-128.png')

export class TabEvents {
  constructor(
    private monetizationService: MonetizationService,
    private storage: StorageService,
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

    const iconData = {
      '34': enabled ? icon34 : iconWarning34,
      '128': enabled ? icon128 : iconWarning128
    }

    if (this.browser.action) {
      await this.browser.action.setIcon({ path: iconData })
    } else if (chrome.browserAction) {
      chrome.browserAction.setIcon({ path: iconData })
    }
  }

  onActivatedTab = async () => {
    await this.changeIcon()
  }

  onCreatedTab = async () => {
    await this.changeIcon()
  }

  onUpdatedTab = async (payload?: IsTabMonetizedPayload) => {
    const { enabled } = await this.storage.get(['enabled'])

    let iconData = {
      '34': enabled ? icon34 : iconWarning34,
      '128': enabled ? icon34 : iconWarning128
    }

    if (enabled) {
      if (payload) {
        const { value } = payload

        iconData = {
          '34': value ? iconActive34 : iconInactive34,
          '128': value ? iconActive128 : iconInactive128
        }
      }
    }

    if (this.browser.action) {
      await this.browser.action.setIcon({ path: iconData })
    } else if (chrome.browserAction) {
      chrome.browserAction.setIcon({ path: iconData })
    }
  }
}
