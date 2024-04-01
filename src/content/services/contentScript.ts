import { Logger } from '@/shared/logger'
import { MonetizationTagManager } from './monetizationTagManager'

export class ContentScript {
  constructor(
    private logger: Logger,
    private monetizationTagManager: MonetizationTagManager
  ) {}

  start() {
    this.logger.info('Content script started')

    this.monetizationTagManager.start()
  }
}
