import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'

import { createLogger, Logger } from '@shared/logger'
import { ContentScript } from './services/contentScript'

interface Cradle {
  logger: Logger
  browser: Browser
  contentScript: ContentScript
}

export const configureContainer = () => {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC
  })

  const logger = createLogger()

  container.register({
    logger: asValue(logger),
    browser: asValue(browser),
    contentScript: asClass(ContentScript)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('content-script:main')
      }))
  })

  return container
}
