import { MonetizationService } from './monetization'

export class TabEvents {
  constructor(private monetizationService: MonetizationService) {}

  onRemovedTab = (tabId: number) => {
    this.monetizationService.clearTabSessions(tabId)
  }

  // TODO: This is not ideal. Find a better way to clear the sessions for a specific tab.
  // When closing the tab, we receive the STOP_MONETIZATION message as well.
  // Maybe check if the tab is closed in the content script?
  onUpdatedTab = (tabId: number, ...rest: any) => {
      console.log(tabId, rest)
    this.monetizationService.clearTabSessions(tabId)
  }
}
