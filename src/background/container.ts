import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'
import { Background } from '@/background/services/background'
import { EventsService, OpenPaymentsService } from './services'
import { StorageService } from '@/background/services/storage'
import { createLogger, Logger } from '@/shared/logger'

interface Cradle {
  logger: Logger
  browser: Browser
  storage: StorageService
  eventsService: EventsService
  openPaymentsService: OpenPaymentsService
  background: Background
}

export const configureContainer = () => {
  // Create container
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC
  })

  const logger = createLogger()

  // Register services
  container.register({
    logger: asValue(logger),
    browser: asValue(browser),
    storage: asClass(StorageService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('background:storage')
      })),
    eventsService: asClass(EventsService).singleton(),
    openPaymentsService: asClass(OpenPaymentsService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('background:open-payments')
      })),
    background: asClass(Background)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('background:main')
      }))
  })

  return container
}
