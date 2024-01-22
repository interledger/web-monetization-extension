import {
  createHeaders,
  Headers,
  loadBase64Key,
  RequestLike,
} from '@interledger/http-signature-utils';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

interface Context<TResponseBody = unknown>
  extends Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, TResponseBody> {}

interface GenerateSignatureRequestBody extends RequestLike {}

function validateBody(body: any): body is GenerateSignatureRequestBody {
  return !!body.headers && !!body.method && !!body.url;
}

async function validatePath(ctx: Context, next: Koa.Next): Promise<void> {
  if (ctx.path !== '/') {
    ctx.status = 404;
  } else {
    await next();
  }
}

async function validateMethod(ctx: Context, next: Koa.Next): Promise<void> {
  if (ctx.method !== 'POST') {
    ctx.status = 405;
  } else {
    await next();
  }
}

async function createHeadersHandler(ctx: Context<Headers>): Promise<void> {
  const { body } = ctx.request;

  if (!validateBody(body)) {
    ctx.throw('Invalid request body', 400);
  }

  let privateKey: ReturnType<typeof loadBase64Key>;

  try {
    privateKey = loadBase64Key(BASE64_PRIVATE_KEY);
  } catch {
    ctx.throw('Not a valid private key', 400);
  }

  if (privateKey === undefined) {
    ctx.throw('Not an Ed25519 private key', 400);
  }

  const headers = await createHeaders({
    request: body,
    privateKey,
    keyId: KEY_ID,
  });

  delete headers['Content-Length'];
  delete headers['Content-Type'];

  ctx.body = headers;
}

const PORT = 3000;
const BASE64_PRIVATE_KEY =
  'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUUvVlJTRVUzYS9CTUE2cmhUQnZmKzcxMG10YWlmbkF6SzFsWGpDK0QrSTkKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQ==';
const KEY_ID = 'f0ac2190-54d5-47c8-b061-221e7068d823';

const app = new Koa<Koa.DefaultState, Context>();

app.use(bodyParser());
app.use(validatePath);
app.use(validateMethod);
app.use(createHeadersHandler);

app.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log(`Local signatures server started on port ${PORT}`);
});
