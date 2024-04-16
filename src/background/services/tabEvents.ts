import { Browser } from 'webextension-polyfill'
import { MonetizationService } from './monetization'

export class TabEvents {
  constructor(
    private monetizationService: MonetizationService
  ) {}

  onRemovedTab = (tabId: number) => {
    this.monetizationService.clearTabSession(tabId)
  }
}
