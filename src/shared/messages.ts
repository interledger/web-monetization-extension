import type { WalletAddress, OutgoingPayment } from '@interledger/open-payments'
import type { Browser } from 'webextension-polyfill'
import type { AmountValue, Storage } from '@/shared/types'
import type { PopupState } from '@/popup/lib/context'

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

export interface ConnectWalletPayload {
  walletAddressUrl: string
  amount: string
  recurring: boolean
}

export interface AddFundsPayload {
  amount: string
  recurring: boolean
}

export interface PayWebsitePayload {
  amount: string
}

export interface UpdateRateOfPayPayload {
  rateOfPay: string
}

export type PopupToBackgroundMessage = {
  GET_CONTEXT_DATA: {
    input: void
    output: PopupState
  }
  CONNECT_WALLET: {
    input: ConnectWalletPayload
    output: void
  }
  RECONNECT_WALLET: {
    input: void
    output: void
  }
  ADD_FUNDS: {
    input: AddFundsPayload
    output: void
  }
  DISCONNECT_WALLET: {
    input: void
    output: void
  }
  TOGGLE_WM: {
    input: void
    output: void
  }
  PAY_WEBSITE: {
    input: PayWebsitePayload
    output: void
  }
  UPDATE_RATE_OF_PAY: {
    input: UpdateRateOfPayPayload
    output: void
  }
}
// #endregion

// #region Content ↦ BG
export enum ContentToBackgroundAction {
  CHECK_WALLET_ADDRESS_URL = 'CHECK_WALLET_ADDRESS_URL',
  START_MONETIZATION = 'START_MONETIZATION',
  STOP_MONETIZATION = 'STOP_MONETIZATION',
  RESUME_MONETIZATION = 'RESUME_MONETIZATION',
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
  intent?: 'remove' | 'disable'
}

export interface ResumeMonetizationPayload {
  requestId: string
}

export interface IsTabMonetizedPayload {
  value: boolean
}

type MessageMap = Record<
  string,
  {
    input: unknown
    output: unknown
  }
>

export type ContentToBackgroundMessage = {
  CHECK_WALLET_ADDRESS_URL: {
    input: CheckWalletAddressUrlPayload
    output: WalletAddress
  }
  STOP_MONETIZATION: {
    input: StopMonetizationPayload[]
    output: void
  }
  START_MONETIZATION: {
    input: StartMonetizationPayload[]
    output: void
  }
  RESUME_MONETIZATION: {
    input: ResumeMonetizationPayload[]
    output: void
  }
  IS_WM_ENABLED: {
    input: undefined
    output: boolean
  }
}

// #endregion
type ToBackgroundMessageMap = PopupToBackgroundMessage &
  ContentToBackgroundMessage &
  BackgroundToContentMessage

export type ToBackgroundMessage = {
  [K in keyof ToBackgroundMessageMap]: {
    action: K
    payload: ToBackgroundMessageMap[K]['input']
  }
}[keyof ToBackgroundMessageMap]

// #region BG ↦ Content
export type ToContentMessage = {
  [K in keyof BackgroundToContentMessage]: {
    action: K
    payload: BackgroundToContentMessage[K]['input']
  }
}[keyof BackgroundToContentMessage]

export type BackgroundToContentMessage = {
  MONETIZATION_EVENT: {
    input: MonetizationEventPayload
    output: void
  }
  EMIT_TOGGLE_WM: {
    input: EmitToggleWMPayload
    output: void
  }
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

interface Cradle {
  browser: Browser
}

// #endregion

export class MessageManager<TMessages extends MessageMap> {
  private browser: Cradle['browser']
  constructor({ browser }: Cradle) {
    this.browser = browser
  }

  async send<T extends keyof TMessages>(
    action: T,
    payload: TMessages[T]['input']
  ): Promise<Response<TMessages[T]['output']>> {
    return await this.browser.runtime.sendMessage({ action, payload })
  }

  async sendToTab<T extends keyof TMessages>(
    tabId: number,
    frameId: number,
    action: T,
    payload: TMessages[T]['input']
  ): Promise<
    TMessages[T]['output'] extends void
      ? ErrorResponse
      : Response<TMessages[T]['output']>
  > {
    const message = { action, payload }
    return await this.browser.tabs.sendMessage(tabId, message, { frameId })
  }

  async sendToActiveTab<T extends keyof TMessages>(
    action: T,
    payload: TMessages[T]['input']
  ): Promise<
    TMessages[T]['output'] extends void
      ? ErrorResponse
      : Response<TMessages[T]['output']>
  > {
    const window = await this.browser.windows.getCurrent()
    const activeTabs = await this.browser.tabs.query({
      active: true,
      windowId: window.id
    })
    const activeTab = activeTabs[0]
    const message = { action, payload }
    return await this.browser.tabs.sendMessage(activeTab.id as number, message)
  }
}

// #region BG ↦ Popup
export interface BackgroundToPopupMessagesMap {
  SET_BALANCE: Record<'recurring' | 'oneTime' | 'total', AmountValue>
  SET_IS_MONETIZED: boolean
  SET_STATE: { state: Storage['state']; prevState: Storage['state'] }
  SET_ALL_SESSIONS_INVALID: boolean
}

export type BackgroundToPopupMessage = {
  [K in keyof BackgroundToPopupMessagesMap]: {
    type: K
    data: BackgroundToPopupMessagesMap[K]
  }
}[keyof BackgroundToPopupMessagesMap]

export const BACKGROUND_TO_POPUP_CONNECTION_NAME = 'popup'
// #endregion
