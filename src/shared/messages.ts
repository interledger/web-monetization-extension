import { WalletAddress } from '@interledger/open-payments'
import { type Browser } from 'webextension-polyfill'

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

export enum PopupToBackgroundAction {
  GET_CONTEXT_DATA = 'GET_CONTEXT_DATA',
  CONNECT_WALLET = 'CONNECT_WALLET',
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
}

export interface ResumeMonetizationPayload {
  requestId: string
}

export interface IsTabMonetizedPayload {
  value: boolean
}

export interface ContentToBackgroundActionPayload {
  [ContentToBackgroundAction.CHECK_WALLET_ADDRESS_URL]: CheckWalletAddressUrlPayload
  [ContentToBackgroundAction.START_MONETIZATION]: StartMonetizationPayload
  [ContentToBackgroundAction.STOP_MONETIZATION]: StopMonetizationPayload
  [ContentToBackgroundAction.RESUME_MONETIZATION]: ResumeMonetizationPayload
  [ContentToBackgroundAction.IS_TAB_MONETIZED]: IsTabMonetizedPayload
  [ContentToBackgroundAction.IS_WM_ENABLED]: undefined
}

export type ContentToBackgroundMessage = {
  [K in ContentToBackgroundAction]: MessageHKT<
    K,
    ContentToBackgroundActionPayload[K]
  >
}[ContentToBackgroundAction]

export type BackgroundToContentMessage = {
  [K in BackgroundToContentAction]: MessageHKT<
    K,
    BackgroundToContentActionPayload[K]
  >
}[BackgroundToContentAction]

export interface BackgroundToContentActionPayload {
  [BackgroundToContentAction.MONETIZATION_EVENT]: MonetizationEventPayload
}

export type ToBackgroundMessage =
  | PopupToBackgroundMessage
  | ContentToBackgroundMessage
  | BackgroundToContentMessage

export enum BackgroundToContentAction {
  MONETIZATION_EVENT = 'MONETIZATION_EVENT',
  EMIT_TOGGLE_WM = 'EMIT_TOGGLE_WM'
}

export interface MonetizationEventPayload {
  requestId: string
  details: any
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
    const activeTabs = await this.browser.tabs.query({
      active: true,
      currentWindow: true
    })
    const activeTab = activeTabs[0]
    return await this.browser.tabs.sendMessage(activeTab.id as number, message)
  }
}
