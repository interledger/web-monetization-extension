import type { Runtime } from 'webextension-polyfill';
import {
  BACKGROUND_TO_POPUP_CONNECTION_NAME as CONNECTION_NAME,
  type BackgroundToPopupMessage,
  type BackgroundToPopupMessagesMap,
} from '@/shared/messages';
import type { Cradle } from '@/background/container';

export class SendToPopup {
  private browser: Cradle['browser'];

  private isConnected = false;
  private port: Runtime.Port;

  constructor({ browser }: Cradle) {
    Object.assign(this, { browser });
  }

  start() {
    this.browser.runtime.onConnect.addListener((port) => {
      if (port.name !== CONNECTION_NAME) return;
      if (port.error) {
        return;
      }
      this.port = port;
      this.isConnected = true;
      port.onDisconnect.addListener(() => {
        this.isConnected = false;
      });
    });
  }

  get isPopupOpen() {
    return this.isConnected;
  }

  async send<T extends keyof BackgroundToPopupMessagesMap>(
    type: T,
    data: BackgroundToPopupMessagesMap[T],
  ) {
    if (!this.isConnected) {
      return;
    }
    const message = { type, data } as BackgroundToPopupMessage;
    this.port.postMessage(message);
  }
}
