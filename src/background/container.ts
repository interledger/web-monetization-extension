import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'

import Background from './Background'
import { BrowserEventsService, EventsService } from './services'

interface Cradle {
  background: Background
  browser: Browser
  eventsService: EventsService
  browserEventsService: BrowserEventsService
}

export const createBackgroundContainer = () => {
  // Create container
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC,
  })

  // Register services
  container.register({
    browser: asValue(browser),
    background: asClass(Background).singleton(),
    eventsService: asClass(EventsService).singleton(),
    browserEventsService: asClass(BrowserEventsService).singleton(),
  })

  console.log('Start initialization')

  const background = container.resolve('background')

  // Subscribe to messages
  // background.subscribeToInstall()
  background.subscribeToEvents()
  // background.subscribeToMessages()
  background.subscribeToBrowserEvents()

  console.log('End initialization')
}
