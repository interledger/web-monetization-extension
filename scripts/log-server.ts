import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { formatWithOptions, styleText } from 'node:util';
import type { RemoteLoggerMessage } from '@/shared/logger';

const PORT = process.env.LOG_SERVER_PORT || 8000;
const CORS_HEADERS = {
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return respond(res);
  }

  const body = await getBody(req);
  if (!body) return respond(res, 400);

  const logs = JSON.parse(body) as RemoteLoggerMessage[];
  for (const log of logs) {
    console.log(
      `▶ ${styleText('dim', timestampFormat.format(new Date(log.timestamp)))}`,
      styleText(
        'inverse',
        `[${log.logger.toUpperCase()}:${styleText(['italic', 'dim'], log.methodName)}]`,
      ),
      log.msg
        .map((e) =>
          typeof e === 'object'
            ? formatWithOptions({ colors: true }, '%o', e)
            : formatWithOptions({ compact: true }, '%s', e),
        )
        .join(' '),
      styleText(['italic', 'dim'], log.stackTrace[0]?.trim()),
      '\n',
    );
  }

  return respond(res);
});

server.listen(PORT, () => {
  console.warn(`Log server listening on port ${PORT}`);
});

const timestampFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  fractionalSecondDigits: 3,
  hour12: false,
});

function respond(res: ServerResponse<IncomingMessage>, statusCode = 200) {
  res.writeHead(statusCode, { ...CORS_HEADERS }).end();
}

function getBody(req: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      resolve(body);
    });
  });
}
