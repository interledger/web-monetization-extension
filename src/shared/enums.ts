export const enum ErrorCode {
  CONTINUATION_FAILED = 'continuation_failed',
  HASH_FAILED = 'hash_failed',
  KEY_ADD_FAILED = 'key_add_failed',
}

export const enum GrantResult {
  GRANT_SUCCESS = 'grant_success',
  GRANT_ERROR = 'grant_error',
  KEY_ADD_SUCCESS = 'key_add_success',
  KEY_ADD_ERROR = 'key_add_error',
}

export const enum InteractionIntent {
  CONNECT = 'connect',
  RECONNECT = 'reconnect',
  FUNDS = 'funds',
  UPDATE_BUDGET = 'update_budget',
}
