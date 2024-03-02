import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'
import { Background } from '@/background/background'
import { EventsService, OpenPaymentsService } from './services'
import { StorageService } from '@/background/services/storage'

interface Cradle {
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

  // Register services
  container.register({
    browser: asValue(browser),
    storage: asClass(StorageService).singleton(),
    eventsService: asClass(EventsService).singleton(),
    openPaymentsService: asClass(OpenPaymentsService).singleton(),
    background: asClass(Background).singleton()
  })

  return container
}
