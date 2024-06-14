import type { LogLevelDesc } from 'loglevel'

declare const CONFIG_LOG_LEVEL: LogLevelDesc
declare const CONFIG_PERMISSION_HOSTS: { origins: string[] }
declare const CONFIG_ALLOWED_PROTOCOLS: string[]

export const LOG_LEVEL = CONFIG_LOG_LEVEL
export const PERMISSION_HOSTS = CONFIG_PERMISSION_HOSTS
export const ALLOWED_PROTOCOLS = CONFIG_ALLOWED_PROTOCOLS
