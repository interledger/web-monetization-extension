import type { WalletAddress, OutgoingPayment } from '@interledger/open-payments'
import type { Browser } from 'webextension-polyfill'
import type { AmountValue, Storage } from '@/shared/types'
import type { PopupState } from '@/popup/lib/context'

// #region MessageManager
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

type MessageMap = Record<string, { input: unknown; output: unknown }>

export class MessageManager<TMessages extends MessageMap> {
  private browser: Browser
  constructor({ browser }: { browser: Browser }) {
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
// #endregion

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

// #region To BG
type ToBackgroundMessageMap = PopupToBackgroundMessage &
  ContentToBackgroundMessage

export type ToBackgroundMessage = {
  [K in keyof ToBackgroundMessageMap]: {
    action: K
    payload: ToBackgroundMessageMap[K]['input']
  }
}[keyof ToBackgroundMessageMap]
// #endregion

// #region BG ↦ Content
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

export type ToContentMessage = {
  [K in keyof BackgroundToContentMessage]: {
    action: K
    payload: BackgroundToContentMessage[K]['input']
  }
}[keyof BackgroundToContentMessage]
// #endregion

// #region BG ↦ Popup
export const BACKGROUND_TO_POPUP_CONNECTION_NAME = 'popup'

// These methods are fire-and-forget, nothing is returned.
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
// #endregion
