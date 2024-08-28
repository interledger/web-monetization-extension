import log from 'loglevel';

// TODO: Disable debug logging in production
export const createLogger = (level: log.LogLevelDesc = 'DEBUG') => {
  /** This disables all logging below the given level,  */
  log.setLevel(level, false);

  return log;
};

export type Logger = log.RootLogger;
