import type { Runtime } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';
import type { BackgroundToPortMessagesMap } from '@/shared/messages';

export class SendToPort<Message extends BackgroundToPortMessagesMap> {
  private browser: Cradle['browser'];
  private port: Runtime.Port;
  private isConnected = false;
  private connectionName: string;

  constructor({
    browser,
    connectionName,
  }: Cradle & { connectionName: string }) {
    Object.assign(this, { browser, connectionName });
  }

  start() {
    this.browser.runtime.onConnect.addListener((port) => {
      if (port.name !== this.connectionName) return;
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

  get isPortOpen() {
    return this.isConnected;
  }

  async send<K extends keyof Message>(type: K, data: Message[K]) {
    if (!this.isConnected) {
      return;
    }

    const message = { type, data };
    this.port.postMessage(message);
  }
}
