declare type EXTMessageType =
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

declare type EXTMessage<T = any> = {
  type: EXTMessageType
  data?: T
}
