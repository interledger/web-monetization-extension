import log from 'loglevel'

// TODO: Disable debug logging in production
export const createLogger = (level: log.LogLevelDesc = 'DEBUG') => {
  /** This disables all logging below the given level,  */
  log.setLevel(level, false)

  const factory = log.methodFactory
  log.methodFactory = (methodName, logLevel, loggerName) => {
    const raw = factory(methodName, logLevel, loggerName)

    return function (...args) {
      const messages = [
        `%c${loggerName as string}`,
        'font-weight: bold; text-transform: uppercase; background: #2f8785; padding-inline: 5px;',
        ...args,
      ]
      raw(...messages)
    }
  }
  log.rebuild()

  return log
}

export type Logger = log.RootLogger
