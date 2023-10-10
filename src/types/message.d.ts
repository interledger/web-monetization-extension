declare type EXTMessageType = 'SET_MONETIZATION_READY' | 'IS_MONETIZATION_READY'

declare type EXTMessage<T = any> = {
  type: EXTMessageType
  data?: T
}
