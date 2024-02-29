// export type EXTMessageType =
//   | 'SET_MONETIZATION_READY'
//   | 'IS_MONETIZATION_READY'
//   | 'SET_INCOMING_POINTER'
//   | 'GET_SENDING_PAYMENT_POINTER'
//   | 'START_PAYMENT'
//   | 'RUN_PAYMENT'
//   | 'START_MONETIZATION'
//   | 'START_PAYMENTS'
//   | 'STOP_PAYMENTS'
//   | 'PAYMENT_SUCCESS'
//   | 'PAUSE_PAYMENTS'
//   | 'LOAD'
//   | 'GET_STORAGE_DATA'
//   | 'SET_STORAGE_DATA'
//   | 'GET_STORAGE_KEY'
//   | 'SET_STORAGE_KEY'

// export type EXTMessage<T = any> = {
//   type: EXTMessageType
//   data?: T
// }

// export type EXTResponseType = 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNAUTHORIZED' | 'AUTHENTICATED'

// export type EXTResponse<T = any> = {
//   type: EXTResponseType
//   data?: T
// }

export enum PopupToBackgroundAction {
  GET_CONTEXT_DATA = 'GET_CONTEXT_DATA',
  CONNECT_WALLET = 'CONNECT_WALLET',
}

export interface PopupToBackgroundActionPayload {
  [PopupToBackgroundAction.GET_CONTEXT_DATA]: undefined
  [PopupToBackgroundAction.CONNECT_WALLET]: { test: string; a: string; c: boolean }
}

export enum ContentToBackgroundAction {
  TEST_ACTION = 'TEST_ACTION',
}

export interface ContentToBackgroundActionPayload {
  [ContentToBackgroundAction.TEST_ACTION]: { a: string }
}

export type PopupToBackgroundMessage = {
  [K in PopupToBackgroundAction]: {
    action: K
    payload: PopupToBackgroundActionPayload[K]
  }
}[PopupToBackgroundAction]

export type ContentToBackgroundMessage = {
  [K in ContentToBackgroundAction]: {
    action: K
    payload: ContentToBackgroundActionPayload[K]
  }
}[ContentToBackgroundAction]

export type BackgroundMessage = PopupToBackgroundMessage | ContentToBackgroundMessage

export interface Amount {
  value: number
  interval?: string // https://en.wikipedia.org/wiki/ISO_8601#Repeating_intervals
}

type Success = {
  success: true
  data: any
  error?: never
}

type Error = {
  succes: false
  data?: never
  error: any
}

// TODO: Custom catcher in utils
type MessageResponse = Success | Error
