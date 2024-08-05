import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'
import {
  OpenPaymentsService,
  StorageService,
  MonetizationService,
  Background,
  TabEvents,
  TabState,
  SendToPopup,
  EventsService,
  Heartbeat,
  Deduplicator
} from './services'
import { createLogger, Logger } from '@/shared/logger'
import { LOG_LEVEL } from '@/shared/defines'
import { tFactory, type Translation } from '@/shared/helpers'

interface Cradle {
  logger: Logger
  browser: Browser
  events: EventsService
  deduplicator: Deduplicator
  storage: StorageService
  openPaymentsService: OpenPaymentsService
  monetizationService: MonetizationService
  sendToPopup: SendToPopup
  tabEvents: TabEvents
  background: Background
  t: Translation
  tabState: TabState
  heartbeat: Heartbeat
}

export const configureContainer = () => {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC
  })

  const logger = createLogger(LOG_LEVEL)

  container.register({
    logger: asValue(logger),
    browser: asValue(browser),
    t: asValue(tFactory(browser)),
    events: asClass(EventsService).singleton(),
    deduplicator: asClass(Deduplicator)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('deduplicator')
      })),
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
        logger: logger.getLogger('monetization')
      })),
    tabEvents: asClass(TabEvents).singleton(),
    sendToPopup: asClass(SendToPopup).singleton(),
    background: asClass(Background)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('main')
      })),
    tabState: asClass(TabState)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('tab-state')
      })),
    heartbeat: asClass(Heartbeat).singleton()
  })

  return container
}
