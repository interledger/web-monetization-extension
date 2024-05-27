import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'
import {
  OpenPaymentsService,
  StorageService,
  MonetizationService,
  Background,
  TabEvents
} from './services'
import { createLogger, Logger } from '@/shared/logger'
import { LOG_LEVEL } from '@/shared/defines'
import { EventsService } from './services/events'

interface Cradle {
  logger: Logger
  browser: Browser
  events: EventsService
  storage: StorageService
  openPaymentsService: OpenPaymentsService
  monetizationService: MonetizationService
  tabEvents: TabEvents
  background: Background
}

export const configureContainer = () => {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC
  })

  const logger = createLogger(LOG_LEVEL)

  container.register({
    logger: asValue(logger),
    browser: asValue(browser),
    events: asClass(EventsService).singleton(),
    storage: asClass(StorageService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('storage')
      })),
    openPaymentsService: asClass(OpenPaymentsService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('open-payments')
      })),
    monetizationService: asClass(MonetizationService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('monetization-service')
      })),
    tabEvents: asClass(TabEvents).singleton(),
    background: asClass(Background)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('main')
      }))
  })

  return container
}
