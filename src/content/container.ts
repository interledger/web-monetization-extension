import {
  asClass,
  asValue,
  createContainer,
  InjectionMode,
} from 'awilix/browser';
import browser, { type Browser } from 'webextension-polyfill';
import { createLogger, type Logger } from '@/shared/logger';
import { ContentScript } from './services/contentScript';
import { MonetizationLinkManager } from './services/monetizationLinkManager';
import { LOG_LEVEL } from '@/shared/defines';
import { FrameManager } from './services/frameManager';
import {
  type ContentToBackgroundMessage,
  MessageManager,
} from '@/shared/messages';

export interface Cradle {
  logger: Logger;
  browser: Browser;
  document: Document;
  window: Window;
  global: typeof globalThis;
  message: MessageManager<ContentToBackgroundMessage>;
  monetizationLinkManager: MonetizationLinkManager;
  frameManager: FrameManager;
  contentScript: ContentScript;
}

export const configureContainer = () => {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
  });

  const logger = createLogger(LOG_LEVEL);

  container.register({
    logger: asValue(logger),
    browser: asValue(browser),
    document: asValue(document),
    window: asValue(window),
    global: asValue(globalThis),
    message: asClass(MessageManager<ContentToBackgroundMessage>).singleton(),
    frameManager: asClass(FrameManager)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('content-script:frameManager'),
      })),
    monetizationLinkManager: asClass(MonetizationLinkManager)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('content-script:tagManager'),
      })),
    contentScript: asClass(ContentScript)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('content-script:main'),
      })),
  });

  return container;
};
