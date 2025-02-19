import log from 'loglevel';
import remote from 'loglevel-plugin-remote';

// TODO: Disable debug logging in production
export const createLogger = (level: log.LogLevelDesc = 'DEBUG') => {
  /** This disables all logging below the given level,  */
  log.setLevel(level, false);

  const factory = log.methodFactory;
  log.methodFactory = (methodName, logLevel, loggerName) => {
    const raw = factory(methodName, logLevel, loggerName);
    return raw.bind(
      log,
      `%c${loggerName as string}`,
      'font-weight: bold; text-transform: uppercase; background: #2f8785; color: #fff; padding-inline: 5px;',
    );
  };
  log.rebuild();

  remote.apply(log, { url: 'http://127.0.0.1:8000',format: remote.json, });

  return log;
};

export type Logger = log.RootLogger;
