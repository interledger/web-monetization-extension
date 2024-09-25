import type {
  WalletAddress,
  OutgoingPayment,
} from '@interledger/open-payments';
import type { Browser } from 'webextension-polyfill';
import type { AmountValue, Storage } from '@/shared/types';
import type { ErrorWithKeyLike } from '@/shared/helpers';
import type { PopupState } from '@/popup/lib/context';

// #region MessageManager
export interface SuccessResponse<TPayload = void> {
  success: true;
  payload: TPayload;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error?: ErrorWithKeyLike;
}

export type Response<TPayload = void> =
  | SuccessResponse<TPayload>
  | ErrorResponse;

type MessageMap = Record<string, { input: unknown; output: unknown }>;
type MessagesWithInput<T extends MessageMap> = {
  [K in keyof T as T[K]['input'] extends never ? never : K]: T[K];
};
type MessagesWithoutInput<T extends MessageMap> = {
  [K in keyof T as T[K]['input'] extends never ? K : never]: T[K];
};

export class MessageManager<TMessages extends MessageMap> {
  private browser: Browser;
  constructor({ browser }: { browser: Browser }) {
    this.browser = browser;
  }

  async send<TT extends MessagesWithInput<TMessages>, K extends keyof TT>(
    action: K,
    payload: TT[K]['input'],
  ): Promise<Response<TT[K]['output']>>;
  async send<TT extends MessagesWithoutInput<TMessages>, K extends keyof TT>(
    action: K,
    payload?: never,
  ): Promise<Response<TT[K]['output']>>;
  async send<K extends keyof TMessages>(
    action: K,
    payload?: TMessages[K]['input'] extends void
      ? never
      : TMessages[K]['input'],
  ): Promise<Response<TMessages[K]['output']>> {
    return await this.browser.runtime.sendMessage({ action, payload });
  }

  async sendToTab<T extends keyof TMessages>(
    tabId: number,
    frameId: number,
    action: T,
    payload: TMessages[T]['input'],
  ): Promise<
    TMessages[T]['output'] extends void
      ? ErrorResponse
      : Response<TMessages[T]['output']>
  > {
    const message = { action, payload };
    return await this.browser.tabs.sendMessage(tabId, message, { frameId });
  }

  async sendToActiveTab<T extends keyof TMessages>(
    action: T,
    payload: TMessages[T]['input'],
  ): Promise<
    TMessages[T]['output'] extends void
      ? ErrorResponse
      : Response<TMessages[T]['output']>
  > {
    const window = await this.browser.windows.getCurrent();
    const activeTabs = await this.browser.tabs.query({
      active: true,
      windowId: window.id,
    });
    const activeTab = activeTabs[0];
    const message = { action, payload };
    return await this.browser.tabs.sendMessage(activeTab.id as number, message);
  }
}
// #endregion

// #region Popup ↦ BG
export interface ConnectWalletPayload {
  walletAddressUrl: string;
  amount: string;
  recurring: boolean;
}

export interface AddFundsPayload {
  amount: string;
  recurring: boolean;
}

export interface PayWebsitePayload {
  amount: string;
}

export interface UpdateRateOfPayPayload {
  rateOfPay: string;
}

export type PopupToBackgroundMessage = {
  GET_CONTEXT_DATA: {
    input: never;
    output: PopupState;
  };
  CONNECT_WALLET: {
    input: ConnectWalletPayload;
    output: never;
  };
  RECONNECT_WALLET: {
    input: never;
    output: never;
  };
  ADD_FUNDS: {
    input: AddFundsPayload;
    output: never;
  };
  DISCONNECT_WALLET: {
    input: never;
    output: never;
  };
  TOGGLE_WM: {
    input: never;
    output: never;
  };
  PAY_WEBSITE: {
    input: PayWebsitePayload;
    output: never;
  };
  UPDATE_RATE_OF_PAY: {
    input: UpdateRateOfPayPayload;
    output: never;
  };
};
// #endregion

// #region Content ↦ BG
export interface GetWalletAddressInfoPayload {
  walletAddressUrl: string;
}

export interface StartMonetizationPayloadEntry {
  walletAddress: WalletAddress;
  requestId: string;
}
export type StartMonetizationPayload = StartMonetizationPayloadEntry[];

export interface StopMonetizationPayloadEntry {
  requestId: string;
  intent?: 'remove' | 'disable';
}
export type StopMonetizationPayload = StopMonetizationPayloadEntry[];

export interface ResumeMonetizationPayloadEntry {
  requestId: string;
}
export type ResumeMonetizationPayload = ResumeMonetizationPayloadEntry[];

export interface IsTabMonetizedPayload {
  value: boolean;
}

export type ContentToBackgroundMessage = {
  GET_WALLET_ADDRESS_INFO: {
    input: GetWalletAddressInfoPayload;
    output: WalletAddress;
  };
  TAB_FOCUSED: {
    input: never;
    output: never;
  };
  STOP_MONETIZATION: {
    input: StopMonetizationPayload;
    output: never;
  };
  START_MONETIZATION: {
    input: StartMonetizationPayload;
    output: never;
  };
  RESUME_MONETIZATION: {
    input: ResumeMonetizationPayload;
    output: never;
  };
};
// #endregion

// #region To BG
type ToBackgroundMessageMap = PopupToBackgroundMessage &
  ContentToBackgroundMessage;

export type ToBackgroundMessage = {
  [K in keyof ToBackgroundMessageMap]: {
    action: K;
    payload: ToBackgroundMessageMap[K]['input'];
  };
}[keyof ToBackgroundMessageMap];
// #endregion

// #region BG ↦ Content
export interface MonetizationEventDetails {
  amountSent: PaymentCurrencyAmount;
  incomingPayment: OutgoingPayment['receiver'];
  paymentPointer: WalletAddress['id'];
}

export interface MonetizationEventPayload {
  requestId: string;
  details: MonetizationEventDetails;
}

export type BackgroundToContentMessage = {
  MONETIZATION_EVENT: {
    input: MonetizationEventPayload;
    output: never;
  };
  IS_TAB_IN_VIEW: {
    input: undefined;
    output: boolean;
  };
};

export type ToContentMessage = {
  [K in keyof BackgroundToContentMessage]: {
    action: K;
    payload: BackgroundToContentMessage[K]['input'];
  };
}[keyof BackgroundToContentMessage];
// #endregion

// #region BG ↦ Popup
export const BACKGROUND_TO_POPUP_CONNECTION_NAME = 'popup';

// These methods are fire-and-forget, nothing is returned.
export interface BackgroundToPopupMessagesMap {
  SET_BALANCE: Record<'recurring' | 'oneTime' | 'total', AmountValue>;
  SET_IS_MONETIZED: boolean;
  SET_STATE: { state: Storage['state']; prevState: Storage['state'] };
  SET_ALL_SESSIONS_INVALID: boolean;
}

export type BackgroundToPopupMessage = {
  [K in keyof BackgroundToPopupMessagesMap]: {
    type: K;
    data: BackgroundToPopupMessagesMap[K];
  };
}[keyof BackgroundToPopupMessagesMap];
// #endregion
