import { type Browser, runtime } from 'webextension-polyfill'
import { MonetizationService } from './monetization'
import { StorageService } from './storage'
import { IsTabMonetizedPayload } from '@/shared/messages'

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
  // TODO: This is not ideal. Find a better way to clear the sessions for a specific tab.
  // When closing the tab, we receive the STOP_MONETIZATION message as well.
  // Maybe check if the tab is closed in the content script?
  onRemovedTab = (tabId: number) => {
    this.monetizationService.clearTabSessions(tabId)
  }

  onUpdatedTab = async (payload?: IsTabMonetizedPayload) => {
    let iconData = {
      '34': iconInactive34,
      '128': iconInactive128
    }

    if (payload) {
      const { value } = payload

      if (value)
        iconData = {
          '34': iconActive34,
          '128': iconActive128
        }
    } else {
      const { enabled } = await this.storage.get(['enabled'])

      iconData = {
        '34': enabled ? iconActive34 : iconWarning34,
        '128': enabled ? iconActive128 : iconWarning128
      }
    }

    if (this.browser.action) {
      await this.browser.action.setIcon({ path: iconData })
    } else if (chrome.browserAction) {
      chrome.browserAction.setIcon({ path: iconData })
    }
  }
}
