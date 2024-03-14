import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'
import { Background } from '@background/services/background'
import {
  OpenPaymentsService,
  StorageService,
  MonetizationService
} from './services'
import { createLogger, Logger } from '@shared/logger'

interface Cradle {
  logger: Logger
  browser: Browser
  storage: StorageService
  openPaymentsService: OpenPaymentsService
  monetizationService: MonetizationService
  background: Background
}

export const configureContainer = () => {
  // Create container
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC
  })

  const logger = createLogger()

  container.register({
    logger: asValue(logger),
    browser: asValue(browser),
    storage: asClass(StorageService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('background:storage')
      })),
    openPaymentsService: asClass(OpenPaymentsService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('background:open-payments')
      })),
    monetizationService: asClass(MonetizationService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('background:monetization-service')
      })),
    background: asClass(Background)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('background:main')
      }))
  })

  return container
}
