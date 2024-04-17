import { MonetizationService } from './monetization'

export class TabEvents {
  constructor(private monetizationService: MonetizationService) {}

  onRemovedTab = (tabId: number) => {
    this.monetizationService.clearTabSessions(tabId)
  }

  // onUpdatedTab = (tabId: number) => {
  //   this.monetizationService.clearTabSessions(tabId)
  // }
}
