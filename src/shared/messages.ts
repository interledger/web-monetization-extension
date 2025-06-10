import type {
  WalletAddress,
  OutgoingPayment,
} from '@interledger/open-payments';
import type { Browser } from 'webextension-polyfill';
import type { AmountValue, PopupTransientState, Storage } from '@/shared/types';
import type { ErrorWithKeyLike } from '@/shared/helpers';
import type { PopupState } from '@/popup/lib/store';
import type { AppState } from '@/app/lib/store';

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
    frameId: number | undefined,
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
  autoKeyAdd: boolean;
  autoKeyAddConsent: boolean | null;
}

export interface ReconnectWalletPayload {
  autoKeyAddConsent: boolean;
}

export interface AddFundsPayload {
  amount: string;
  recurring: boolean;
}

export interface PayWebsitePayload {
  amount: string;
}

export interface PayWebsiteResponse {
  type: 'full' | 'partial';
  sentAmount: string;
}

export interface UpdateRateOfPayPayload {
  rateOfPay: AmountValue;
}

export interface UpdateBudgetPayload {
  walletAddressUrl: ConnectWalletPayload['walletAddressUrl'];
  amount: ConnectWalletPayload['amount'];
  recurring: ConnectWalletPayload['recurring'];
}

export type PopupToBackgroundMessage = {
  GET_DATA_POPUP: {
    input: never;
    output: PopupState;
  };
  CONNECT_WALLET: {
    input: ConnectWalletPayload;
    output: undefined;
  };
  RESET_CONNECT_STATE: {
    input: never;
    output: undefined;
  };
  UPDATE_BUDGET: {
    input: UpdateBudgetPayload;
    output: undefined;
  };
  RECONNECT_WALLET: {
    input: ReconnectWalletPayload;
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
  TOGGLE_CONTINUOUS_PAYMENTS: {
    input: never;
    output: never;
  };
  TOGGLE_PAYMENTS: {
    input: never;
    output: never;
  };
  PAY_WEBSITE: {
    input: PayWebsitePayload;
    output: PayWebsiteResponse;
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
  intent: 'remove' | 'disable' | 'pause';
}
export type StopMonetizationPayload = StopMonetizationPayloadEntry[];

export type ResumeMonetizationPayload = StartMonetizationPayload;

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

// #region App ↦ BG
export type AppToBackgroundMessage = {
  GET_DATA_APP: {
    input: never;
    output: AppState;
  };
  CONNECT_WALLET: PopupToBackgroundMessage['CONNECT_WALLET'];
  RESET_CONNECT_STATE: PopupToBackgroundMessage['RESET_CONNECT_STATE'];
};
// #endregion

// #region To BG
type ToBackgroundMessageMap = PopupToBackgroundMessage &
  ContentToBackgroundMessage &
  AppToBackgroundMessage;

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
  REQUEST_RESUME_MONETIZATION: {
    input: null;
    output: undefined;
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
  SET_TAB_DATA: PopupState['tab'];
  SET_STATE: { state: Storage['state']; prevState: Storage['state'] };
  SET_TRANSIENT_STATE: PopupTransientState;
  CLOSE_POPUP: undefined;
}

export type BackgroundToPopupMessage = {
  [K in keyof BackgroundToPopupMessagesMap]: {
    type: K;
    data: BackgroundToPopupMessagesMap[K];
  };
}[keyof BackgroundToPopupMessagesMap];
// #endregion

// #region BG ↦ App
export const BACKGROUND_TO_APP_CONNECTION_NAME = 'app';

export interface BackgroundToAppMessagesMap {
  SET_TRANSIENT_STATE: PopupTransientState;
}

export type BackgroundToAppMessage = {
  [K in keyof BackgroundToAppMessagesMap]: {
    type: K;
    data: BackgroundToAppMessagesMap[K];
  };
}[keyof BackgroundToAppMessagesMap];
// #endregion

// #region From BG
export type BackgroundToPortMessagesMap =
  | BackgroundToPopupMessagesMap
  | BackgroundToAppMessagesMap;
// #endregion

export const success = <TPayload = undefined>(
  payload: TPayload,
): SuccessResponse<TPayload> => ({
  success: true,
  payload,
});

export const failure = (message: string | ErrorWithKeyLike) => ({
  success: false as const,
  ...(typeof message === 'string'
    ? { message }
    : { error: message, message: message.key }),
});
