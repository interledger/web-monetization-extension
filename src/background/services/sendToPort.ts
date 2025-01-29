import type { Runtime } from 'webextension-polyfill';
import type { Cradle } from '@/background/container';

export class SendToPort<Message> {
  private browser: Cradle['browser'];
  private port: Runtime.Port;
  private isConnected = false;

  constructor(
    { browser }: Cradle,
    private readonly connectionName: string,
  ) {
    Object.assign(this, { browser });
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
