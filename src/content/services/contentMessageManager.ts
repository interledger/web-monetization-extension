import type { Browser } from '@/shared/browser';
import {
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
      return await super.send(action as never, payload as never);
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
      for (const listener of this.invalidationListeners) {
        listener();
      }
    }
    return failure(EXTENSION_CONTEXT_INVALIDATED);
  }
}
