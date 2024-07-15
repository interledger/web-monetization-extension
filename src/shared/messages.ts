import type { WalletAddress, OutgoingPayment } from '@interledger/open-payments'
import type { Browser } from 'webextension-polyfill'
import type { AmountValue, Storage } from '@/shared/types'

export interface SuccessResponse<TPayload = undefined> {
  success: true
  payload: TPayload
}

export interface ErrorResponse {
  success: false
  message: string
}

export type Response<TPayload = undefined> =
  | SuccessResponse<TPayload>
  | ErrorResponse

export type MessageHKT<
  TAction,
  TPayload = undefined
> = TPayload extends undefined
  ? { action: TAction }
  : { action: TAction; payload: TPayload }

// #region Popup ↦ BG
export enum PopupToBackgroundAction {
  GET_CONTEXT_DATA = 'GET_CONTEXT_DATA',
  CONNECT_WALLET = 'CONNECT_WALLET',
  RECONNECT_WALLET = 'RECONNECT_WALLET',
  DISCONNECT_WALLET = 'DISCONNECT_WALLET',
  TOGGLE_WM = 'TOGGLE_WM',
  PAY_WEBSITE = 'PAY_WEBSITE',
  UPDATE_RATE_OF_PAY = 'UPDATE_RATE_OF_PAY'
}

export interface ConnectWalletPayload {
  walletAddressUrl: string
  amount: string
  recurring: boolean
}

export interface PayWebsitePayload {
  amount: string
}

export interface UpdateRateOfPayPayload {
  rateOfPay: string
}

export interface PopupToBackgroundActionPayload {
  [PopupToBackgroundAction.GET_CONTEXT_DATA]: undefined
  [PopupToBackgroundAction.CONNECT_WALLET]: ConnectWalletPayload
  [PopupToBackgroundAction.RECONNECT_WALLET]: undefined
  [PopupToBackgroundAction.DISCONNECT_WALLET]: undefined
  [PopupToBackgroundAction.TOGGLE_WM]: undefined
  [PopupToBackgroundAction.PAY_WEBSITE]: PayWebsitePayload
  [PopupToBackgroundAction.UPDATE_RATE_OF_PAY]: UpdateRateOfPayPayload
}

export type PopupToBackgroundMessage = {
  [K in PopupToBackgroundAction]: MessageHKT<
    K,
    PopupToBackgroundActionPayload[K]
  >
}[PopupToBackgroundAction]
// #endregion

// #region Content ↦ BG
export enum ContentToBackgroundAction {
  CHECK_WALLET_ADDRESS_URL = 'CHECK_WALLET_ADDRESS_URL',
  START_MONETIZATION = 'START_MONETIZATION',
  STOP_MONETIZATION = 'STOP_MONETIZATION',
  RESUME_MONETIZATION = 'RESUME_MONETIZATION',
  IS_TAB_MONETIZED = 'IS_TAB_MONETIZED',
  IS_WM_ENABLED = 'IS_WM_ENABLED'
}

export interface CheckWalletAddressUrlPayload {
  walletAddressUrl: string
}

export interface StartMonetizationPayload {
  walletAddress: WalletAddress
  requestId: string
}

export interface StopMonetizationPayload {
  requestId: string
  remove?: boolean
}

export interface ResumeMonetizationPayload {
  requestId: string
}

export interface IsTabMonetizedPayload {
  value: boolean
}

export interface ContentToBackgroundActionPayload {
  [ContentToBackgroundAction.CHECK_WALLET_ADDRESS_URL]: CheckWalletAddressUrlPayload
  [ContentToBackgroundAction.START_MONETIZATION]: StartMonetizationPayload[]
  [ContentToBackgroundAction.STOP_MONETIZATION]: StopMonetizationPayload[]
  [ContentToBackgroundAction.RESUME_MONETIZATION]: ResumeMonetizationPayload[]
  [ContentToBackgroundAction.IS_TAB_MONETIZED]: IsTabMonetizedPayload
  [ContentToBackgroundAction.IS_WM_ENABLED]: undefined
}

export type ContentToBackgroundMessage = {
  [K in ContentToBackgroundAction]: MessageHKT<
    K,
    ContentToBackgroundActionPayload[K]
  >
}[ContentToBackgroundAction]
// #endregion

export type ToBackgroundMessage =
  | PopupToBackgroundMessage
  | ContentToBackgroundMessage
  | BackgroundToContentMessage

// #region BG ↦ Content
export type BackgroundToContentMessage = {
  [K in BackgroundToContentAction]: MessageHKT<
    K,
    BackgroundToContentActionPayload[K]
  >
}[BackgroundToContentAction]

export interface BackgroundToContentActionPayload {
  [BackgroundToContentAction.MONETIZATION_EVENT]: MonetizationEventPayload
}

export enum BackgroundToContentAction {
  MONETIZATION_EVENT = 'MONETIZATION_EVENT',
  EMIT_TOGGLE_WM = 'EMIT_TOGGLE_WM'
}

export interface MonetizationEventDetails {
  amountSent: PaymentCurrencyAmount
  incomingPayment: OutgoingPayment['receiver']
  paymentPointer: WalletAddress['id']
}

export interface MonetizationEventPayload {
  requestId: string
  details: MonetizationEventDetails
}

export interface EmitToggleWMPayload {
  enabled: boolean
}

export interface BackgroundToContentActionPayload {
  [BackgroundToContentAction.MONETIZATION_EVENT]: MonetizationEventPayload
  [BackgroundToContentAction.EMIT_TOGGLE_WM]: EmitToggleWMPayload
}
export type BackgroundToContentBackgroundMessage = {
  [K in BackgroundToContentAction]: MessageHKT<
    K,
    BackgroundToContentActionPayload[K]
  >
}[BackgroundToContentAction]

export type ToContentMessage = BackgroundToContentBackgroundMessage
// #endregion

export class MessageManager<TMessages> {
  constructor(private browser: Browser) {}

  async send<TResponse = undefined>(
    message: TMessages
  ): Promise<Response<TResponse>> {
    return await this.browser.runtime.sendMessage(message)
  }

  async sendToTab<TResponse = void>(
    tabId: number,
    frameId: number,
    message: TMessages
  ): Promise<TResponse extends void ? ErrorResponse : Response<TResponse>> {
    return await this.browser.tabs.sendMessage(tabId, message, { frameId })
  }

  async sendToActiveTab<TResponse = void>(
    message: TMessages
  ): Promise<TResponse extends void ? ErrorResponse : Response<TResponse>> {
    const window = await this.browser.windows.getCurrent()
    const activeTabs = await this.browser.tabs.query({
      active: true,
      windowId: window.id
    })
    const activeTab = activeTabs[0]
    return await this.browser.tabs.sendMessage(activeTab.id as number, message)
  }
}

// #region BG ↦ Popup
export interface BackgroundToPopupMessagesMap {
  SET_BALANCE: Record<'recurring' | 'oneTime' | 'total', AmountValue>
  SET_STATE: { state: Storage['state']; prevState: Storage['state'] }
}

export type BackgroundToPopupMessage = {
  [K in keyof BackgroundToPopupMessagesMap]: {
    type: K
    data: BackgroundToPopupMessagesMap[K]
  }
}[keyof BackgroundToPopupMessagesMap]

export const BACKGROUND_TO_POPUP_CONNECTION_NAME = 'popup'
// #endregion
