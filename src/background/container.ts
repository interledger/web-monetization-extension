import {
  asClass,
  asValue,
  createContainer,
  InjectionMode,
} from 'awilix/browser';
import browser, { type Browser } from 'webextension-polyfill';
import {
  OpenPaymentsService,
  StorageService,
  MonetizationService,
  Background,
  TabEvents,
  TabState,
  WindowState,
  SendToPopup,
  EventsService,
  Heartbeat,
  Deduplicator,
} from './services';
import { createLogger, Logger } from '@/shared/logger';
import { LOG_LEVEL } from '@/shared/defines';
import {
  getBrowserName,
  tFactory,
  type BrowserName,
  type Translation,
} from '@/shared/helpers';
import {
  MessageManager,
  type BackgroundToContentMessage,
} from '@/shared/messages';

export interface Cradle {
  logger: Logger;
  browser: Browser;
  browserName: BrowserName;
  appName: string;
  events: EventsService;
  deduplicator: Deduplicator;
  storage: StorageService;
  openPaymentsService: OpenPaymentsService;
  monetizationService: MonetizationService;
  message: MessageManager<BackgroundToContentMessage>;
  sendToPopup: SendToPopup;
  tabEvents: TabEvents;
  background: Background;
  t: Translation;
  tabState: TabState;
  windowState: WindowState;
  heartbeat: Heartbeat;
}

export const configureContainer = () => {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
  });

  const logger = createLogger(LOG_LEVEL);

  container.register({
    logger: asValue(logger),
    browser: asValue(browser),
    browserName: asValue(getBrowserName(browser, navigator.userAgent)),
    appName: asValue(browser.runtime.getManifest().name),
    t: asValue(tFactory(browser)),
    events: asClass(EventsService).singleton(),
    deduplicator: asClass(Deduplicator)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('deduplicator'),
      })),
    storage: asClass(StorageService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('storage'),
      })),
    openPaymentsService: asClass(OpenPaymentsService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('open-payments'),
      })),
    monetizationService: asClass(MonetizationService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('monetization'),
      })),
    message: asClass(MessageManager<BackgroundToContentMessage>).singleton(),
    tabEvents: asClass(TabEvents).singleton(),
    sendToPopup: asClass(SendToPopup).singleton(),
    background: asClass(Background)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('main'),
      })),
    tabState: asClass(TabState)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('tab-state'),
      })),
    windowState: asClass(WindowState)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('window-state'),
      })),
    heartbeat: asClass(Heartbeat).singleton(),
  });

  return container;
};
