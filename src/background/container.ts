import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'

import Background from './Background'
import { EventsService } from './services'

interface Cradle {
  background: Background
  browser: Browser
  eventsService: EventsService
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
  })

  console.log('Start initialization')

  const background = container.resolve('background')

  // Subscribe to messages
  background.subscribeToInstall()
  background.setupEvents()
  // background.subscribeToMessages()
  background.subscribeToTabChanges()

  console.log('End initialization')
}
