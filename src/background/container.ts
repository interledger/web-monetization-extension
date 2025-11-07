import {
  asClass,
  asValue,
  createContainer,
  InjectionMode,
} from 'awilix/browser';
import browser, { type Browser } from 'webextension-polyfill';
import {
  OpenPaymentsService,
  OutgoingPaymentGrantService,
  StorageService,
  WalletService,
  MonetizationService,
  Background,
  TabEvents,
  TabState,
  WindowState,
  SendToPort,
  EventsService,
  Heartbeat,
  Deduplicator,
  PaymentSession,
  PaymentManager,
  Telemetry,
} from './services';
import { createLogger, type Logger, type RootLogger } from '@/shared/logger';
import { LOG_LEVEL } from '@/shared/defines';
import {
  getBrowserName,
  tFactory,
  type BrowserName,
  type Translation,
} from '@/shared/helpers';
import {
  type BackgroundToAppMessagesMap,
  type BackgroundToPopupMessagesMap,
  type BackgroundToContentMessage,
  MessageManager,
  BACKGROUND_TO_POPUP_CONNECTION_NAME,
  BACKGROUND_TO_APP_CONNECTION_NAME,
} from '@/shared/messages';

export interface Cradle {
  logger: Logger;
  rootLogger: RootLogger;
  browser: Browser;
  browserName: BrowserName;
  appName: string;
  events: EventsService;
  deduplicator: Deduplicator;
  storage: StorageService;
  outgoingPaymentGrantService: OutgoingPaymentGrantService;
  openPaymentsService: OpenPaymentsService;
  walletService: WalletService;
  monetizationService: MonetizationService;
  message: MessageManager<BackgroundToContentMessage>;
  sendToPopup: SendToPort<BackgroundToPopupMessagesMap>;
  sendToApp: SendToPort<BackgroundToAppMessagesMap>;
  tabEvents: TabEvents;
  background: Background;
  t: Translation;
  tabState: TabState;
  windowState: WindowState;
  heartbeat: Heartbeat;
  telemetry: Telemetry;
  PaymentSession: typeof PaymentSession;
  PaymentManager: typeof PaymentManager;
}

export const configureContainer = () => {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
  });

  const logger = createLogger(LOG_LEVEL);

  container.register({
    logger: asValue(logger),
    rootLogger: asValue(logger),
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
    outgoingPaymentGrantService: asClass(OutgoingPaymentGrantService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('outgoing-payment-grant'),
      })),
    openPaymentsService: asClass(OpenPaymentsService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('open-payments'),
      })),
    walletService: asClass(WalletService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('wallet'),
      })),
    monetizationService: asClass(MonetizationService)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('monetization'),
      })),
    message: asClass(MessageManager<BackgroundToContentMessage>).singleton(),
    tabEvents: asClass(TabEvents).singleton(),
    sendToPopup: asClass(SendToPort)
      .singleton()
      .inject(() => ({
        connectionName: BACKGROUND_TO_POPUP_CONNECTION_NAME,
      })),
    sendToApp: asClass(SendToPort)
      .singleton()
      .inject(() => ({
        connectionName: BACKGROUND_TO_APP_CONNECTION_NAME,
      })),
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
    telemetry: asClass(Telemetry)
      .singleton()
      .inject(() => ({
        logger: logger.getLogger('telemetry'),
      })),
    heartbeat: asClass(Heartbeat).singleton(),
    PaymentSession: asValue(PaymentSession),
    PaymentManager: asValue(PaymentManager),
  });

  return container;
};
