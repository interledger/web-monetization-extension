import { Logger } from '@shared/logger'

export class ContentScript {
  constructor(private logger: Logger) {}

  start() {
    this.logger.info('Content script started')
  }
}
