export type EXTMessageType =
  | 'SET_MONETIZATION_READY'
  | 'IS_MONETIZATION_READY'
  | 'SET_INCOMING_POINTER'
  | 'GET_SENDING_PAYMENT_POINTER'
  | 'START_PAYMENT'
  | 'RUN_PAYMENT'
  | 'START_MONETIZATION'
  | 'START_PAYMENTS'
  | 'STOP_PAYMENTS'
  | 'PAYMENT_SUCCESS'
  | 'PAUSE_PAYMENTS'
  | 'LOAD'
  | 'GET_STORAGE_DATA'
  | 'SET_STORAGE_DATA'
  | 'GET_STORAGE_KEY'
  | 'SET_STORAGE_KEY'

export type EXTMessage<T = any> = {
  type: EXTMessageType
  data?: T
}

export type EXTResponseType = 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNAUTHORIZED' | 'AUTHENTICATED'

export type EXTResponse<T = any> = {
  type: EXTResponseType
  data?: T
}
