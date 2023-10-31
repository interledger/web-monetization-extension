declare type EXTMessageType =
  | 'SET_MONETIZATION_READY'
  | 'IS_MONETIZATION_READY'
  | 'SET_INCOMING_POINTER'
  | 'GET_SENDING_PAYMENT_POINTER'

declare type EXTMessage<T = any> = {
  type: EXTMessageType
  data?: T
}
