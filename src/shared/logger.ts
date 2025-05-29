import log from 'loglevel';
import { ThrottleBatch } from './helpers';
import { LOG_SERVER_ENDPOINT } from './defines';

// TODO: Disable debug logging in production
export const createLogger = (level: log.LogLevelDesc = 'DEBUG') => {
  /** This disables all logging below the given level,  */
  log.setLevel(level, false);

  const factory = log.methodFactory;
  log.methodFactory = (methodName, logLevel, loggerName) => {
    const raw = factory(methodName, logLevel, loggerName);
    if (loggerName?.toString().includes('/')) {
      const [a, b] = loggerName.toString().split('/', 2);
      return raw.bind(
        log,
        `%c${a}%c/${b}`,
        'font-weight: bold; text-transform: uppercase; background: #2f8785; color: #fff; padding-inline: 5px;',
        'background: #def4ef; color: #000; padding-inline: 5px;',
      );
    }
    return raw.bind(
      log,
      `%c${loggerName as string}`,
      'font-weight: bold; text-transform: uppercase; background: #2f8785; color: #fff; padding-inline: 5px;',
    );
  };
  log.rebuild();

  // Provide a LOG_SERVER=http://127.0.0.1:8000 env var to enable remote
  // logging. The remote logging server is run via `tsx scripts/log-server.ts`
  //
  // Remote logging is excluded from bundle via treeshaking if the `LOG_SERVER`
  // env var is not provided.
  //
  // DO NOT ENABLE THIS FOR PRODUCTION.
  if (LOG_SERVER_ENDPOINT) {
    remoteLogger(log, LOG_SERVER_ENDPOINT);
  }

  return log;
};

export type Logger = log.Logger;
export type RootLogger = log.RootLogger;

export type RemoteLoggerMessage = {
  msg: unknown[];
  timestamp: string;
  methodName: string;
  logger: string;
  stackTrace: string[];
};

function remoteLogger(log: log.RootLogger, endpoint: string) {
  const queue = new ThrottleBatch(send, (logItems) => logItems.flat(), 500);

  const originalFactory = log.methodFactory;
  log.methodFactory = (methodName, logLevel, loggerName) => {
    const raw = originalFactory(methodName, logLevel, loggerName);
    const original = raw.bind(log);
    // Note: this interception breaks the stack trace linenumber in devtools console
    return (...msgArgs: unknown[]) => {
      const logItem: RemoteLoggerMessage = {
        msg: msgArgs,
        methodName,
        timestamp: new Date().toISOString(),
        logger: loggerName?.toString() || '',
        stackTrace: formatStackTrace(getStacktrace()),
      };
      queue.enqueue(logItem);
      original.apply(log, msgArgs);
    };
  };
  log.rebuild();

  function send(...logItems: unknown[]) {
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logItems),
    }).catch(() => {});
  }

  function getStacktrace() {
    try {
      throw new Error();
    } catch (trace) {
      return trace.stack;
    }
  }

  function formatStackTrace(rawStacktrace: string): string[] {
    let stacktrace = rawStacktrace.split('\n');
    const lines = stacktrace;
    lines.splice(0, 3);
    const depth = 3;
    if (depth && lines.length !== depth + 1) {
      const shrink = lines.splice(0, depth);
      stacktrace = shrink;
      if (lines.length) stacktrace.push(`and ${lines.length} more`);
    } else {
      stacktrace = lines;
    }
    return stacktrace;
  }
}
