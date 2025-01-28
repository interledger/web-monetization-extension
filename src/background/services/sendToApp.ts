import type { Runtime } from 'webextension-polyfill';
import {
  BACKGROUND_TO_APP_CONNECTION_NAME as CONNECTION_NAME,
  type BackgroundToAppMessage,
  type BackgroundToAppMessagesMap,
} from '@/shared/messages';
import type { Cradle } from '@/background/container';

export class SendToApp {
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

  async send<T extends keyof BackgroundToAppMessagesMap>(
    type: T,
    data: BackgroundToAppMessagesMap[T],
  ) {
    if (!this.isConnected) {
      return;
    }
    const message = { type, data } as BackgroundToAppMessage;
    this.port.postMessage(message);
  }
}
