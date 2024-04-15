import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import browser, { type Browser } from 'webextension-polyfill'
import { createLogger, Logger } from '@/shared/logger'
import { ContentScript } from './services/contentScript'
import { MonetizationTagManager } from './services/monetizationTagManager'
import { LOG_LEVEL } from '@/shared/defines'

interface Cradle {
  logger: Logger
  browser: Browser
  document: Document
  monetizationTagManager: MonetizationTagManager
  contentScript: ContentScript
}

export const configureContainer = () => {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.CLASSIC
  })

  const logger = createLogger(LOG_LEVEL)

  container.register({
    logger: asValue(logger),
    browser: asValue(browser),
    document: asValue(document),
    monetizationTagManager: asClass(MonetizationTagManager)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('content-script:tagManager')
      })),
    contentScript: asClass(ContentScript)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('content-script:main')
      }))
  })

  return container
}
