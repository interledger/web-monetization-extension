import type { Browser } from '@/shared/browser';
import {
  CONTENT_SCRIPT_CONNECTION_NAME,
  type ContentToBackgroundMessage,
  type ErrorResponse,
  failure,
  type MessageMap,
  MessageManager,
  type MessagesWithInput,
  type MessagesWithoutInput,
  type Response,
} from '@/shared/messages';

export const EXTENSION_CONTEXT_INVALIDATED = 'Extension context invalidated';

// After the extension is disabled/reloaded, Chrome closes the port first and
// removes `runtime.id` shortly after (~100ms), so keep checking for a while.
const CONTEXT_CHECK_INTERVAL_MS = 100;
const CONTEXT_CHECK_ATTEMPTS = 20;

type Port = ReturnType<Browser['runtime']['connect']>;

function isContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(EXTENSION_CONTEXT_INVALIDATED)
  );
}

/**
 * When the extension is updated, reloaded or disabled, content scripts that are
 * already running in a page are not stopped, but they can no longer reach the
 * background (`runtime.id` goes away and sending throws "Extension context
 * invalidated"). Instead of throwing, report a failure and let the content
 * script tear itself down.
 */
export class ContentMessageManager<
  TMessages extends MessageMap = ContentToBackgroundMessage,
> extends MessageManager<TMessages> {
  private extensionBrowser: Browser;
  private invalidated = false;
  private invalidationListeners = new Set<() => void>();
  private watching = false;
  private port: Port | null = null;
  private contextCheckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({ browser }: { browser: Browser }) {
    super({ browser });
    this.extensionBrowser = browser;
  }

  get isContextValid(): boolean {
    if (this.invalidated) return false;
    try {
      // Chrome removes `runtime` (or its `id`) from a disconnected script
      return Boolean(this.extensionBrowser.runtime?.id);
    } catch {
      // Firefox throws on access to objects of an unloaded extension
      return false;
    }
  }

  onInvalidated(listener: () => void) {
    this.invalidationListeners.add(listener);
  }

  /**
   * Keep a port to the background open, so this script notices right away when
   * the extension is disabled, reloaded or updated, instead of only on its next
   * message.
   *
   * The port also closes whenever the background service worker stops for
   * being idle, while the extension is fine. Then it is opened again after the
   * next message that reaches the background, not right away, as that would
   * keep waking up the service worker.
   */
  watchConnection() {
    this.watching = true;
    this.openPort();
  }

  disconnect() {
    this.watching = false;
    if (this.contextCheckTimer) {
      clearTimeout(this.contextCheckTimer);
      this.contextCheckTimer = null;
    }
    const port = this.port;
    this.port = null;
    try {
      port?.disconnect();
    } catch {
      // the runtime may already be gone
    }
  }

  private openPort() {
    if (!this.watching || this.port || this.invalidated) return;
    try {
      const port = this.extensionBrowser.runtime.connect({
        name: CONTENT_SCRIPT_CONNECTION_NAME,
      });
      port.onDisconnect.addListener(() => this.onPortDisconnect(port));
      this.port = port;
    } catch {
      if (!this.isContextValid) this.invalidate();
    }
  }

  private onPortDisconnect(port: Port) {
    if (this.port !== port) return;
    this.port = null;
    try {
      // read it, so Chrome doesn't log it as unchecked
      void this.extensionBrowser.runtime?.lastError;
    } catch {
      // the runtime may already be gone
    }

    let attempts = 0;
    const check = () => {
      this.contextCheckTimer = null;
      if (!this.isContextValid) {
        this.invalidate();
        return;
      }
      if (++attempts < CONTEXT_CHECK_ATTEMPTS) {
        this.contextCheckTimer = setTimeout(check, CONTEXT_CHECK_INTERVAL_MS);
      }
      // otherwise the service worker only went idle: reopen after next message
    };
    this.contextCheckTimer = setTimeout(check, CONTEXT_CHECK_INTERVAL_MS);
  }

  override async send<
    TT extends MessagesWithInput<TMessages>,
    K extends keyof TT,
  >(action: K, payload: TT[K]['input']): Promise<Response<TT[K]['output']>>;
  override async send<
    TT extends MessagesWithoutInput<TMessages>,
    K extends keyof TT,
  >(action: K, payload?: never): Promise<Response<TT[K]['output']>>;
  override async send<K extends keyof TMessages>(
    action: K,
    payload?: TMessages[K]['input'] extends void
      ? never
      : TMessages[K]['input'],
  ): Promise<Response<TMessages[K]['output']>> {
    if (!this.isContextValid) {
      return this.invalidate();
    }
    try {
      const response = await super.send(action as never, payload as never);
      // the background is awake now, so reopening the port doesn't wake it
      this.openPort();
      return response;
    } catch (error) {
      // depending on the browser and on how the extension went away, this is
      // "Extension context invalidated" or a TypeError on the missing runtime
      if (isContextInvalidatedError(error) || !this.isContextValid) {
        return this.invalidate();
      }
      throw error;
    }
  }

  private invalidate(): ErrorResponse {
    if (!this.invalidated) {
      this.invalidated = true;
      this.disconnect();
      for (const listener of this.invalidationListeners) {
        listener();
      }
    }
    return failure(EXTENSION_CONTEXT_INVALIDATED);
  }
}
