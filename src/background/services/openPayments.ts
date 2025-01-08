import {
  type AuthenticatedClient,
  createAuthenticatedClient,
  OpenPaymentsClientError,
} from '@interledger/open-payments/dist/client';
import * as ed from '@noble/ed25519';
import { type Request } from 'http-message-signatures';
import { signMessage } from 'http-message-signatures/lib/httpbis';
import { createContentDigestHeader } from 'httpbis-digest-headers';
import type { Cradle } from '@/background/container';
import { OutgoingPayment } from '@interledger/open-payments';
import { ErrorWithKey, sleep } from '@/shared/helpers';
import {
  OUTGOING_PAYMENT_POLLING_INITIAL_DELAY,
  OUTGOING_PAYMENT_POLLING_INTERVAL,
} from '../config';

interface KeyInformation {
  privateKey: string;
  keyId: string;
}

export interface SignatureHeaders {
  Signature: string;
  'Signature-Input': string;
}

interface ContentHeaders {
  'Content-Digest': string;
  'Content-Length': string;
  'Content-Type': string;
}
type Headers = SignatureHeaders & Partial<ContentHeaders>;

interface RequestLike extends Request {
  body?: string;
}

interface SignOptions {
  request: RequestLike;
  privateKey: Uint8Array;
  keyId: string;
}

export class OpenPaymentsService {
  private browser: Cradle['browser'];
  private storage: Cradle['storage'];

  constructor({ browser, storage }: Cradle) {
    Object.assign(this, {
      browser,
      storage,
    });

    void this.initialize();
  }

  public client: AuthenticatedClient;

  private async initialize() {
    const { connected, walletAddress, oneTimeGrant, recurringGrant } =
      await this.storage.get([
        'connected',
        'walletAddress',
        'oneTimeGrant',
        'recurringGrant',
      ]);

    if (
      connected === true &&
      walletAddress &&
      (recurringGrant || oneTimeGrant)
    ) {
      await this.initClient(walletAddress.id);
    }
  }

  private async getPrivateKeyInformation(): Promise<KeyInformation> {
    const data = await this.browser.storage.local.get(['privateKey', 'keyId']);

    if (data.privateKey && data.keyId) {
      return data as unknown as KeyInformation;
    }

    throw new Error(
      'Could not create OpenPayments client. Missing `privateKey` and `keyId`.',
    );
  }

  private createContentHeaders(body: string): ContentHeaders {
    return {
      'Content-Digest': createContentDigestHeader(
        JSON.stringify(JSON.parse(body)),
        ['sha-512'],
      ),
      'Content-Length': new TextEncoder().encode(body).length.toString(),
      'Content-Type': 'application/json',
    };
  }

  private createSigner(key: Uint8Array, keyId: string) {
    return {
      id: keyId,
      alg: 'ed25519',
      async sign(data: Uint8Array) {
        return Buffer.from(await ed.signAsync(data, key.slice(16)));
      },
    };
  }

  private async createSignatureHeaders({
    request,
    privateKey,
    keyId,
  }: SignOptions): Promise<SignatureHeaders> {
    const components = ['@method', '@target-uri'];
    if (request.headers['Authorization'] || request.headers['authorization']) {
      components.push('authorization');
    }

    if (request.body) {
      components.push('content-digest', 'content-length', 'content-type');
    }

    const signingKey = this.createSigner(privateKey, keyId);
    const { headers } = await signMessage(
      {
        name: 'sig1',
        params: ['keyid', 'created'],
        fields: components,
        key: signingKey,
      },
      {
        url: request.url,
        method: request.method,
        headers: request.headers,
      },
    );

    return {
      Signature: headers['Signature'] as string,
      'Signature-Input': headers['Signature-Input'] as string,
    };
  }

  private async createHeaders({
    request,
    privateKey,
    keyId,
  }: SignOptions): Promise<Headers> {
    if (request.body) {
      const contentHeaders = this.createContentHeaders(request.body);
      request.headers = { ...request.headers, ...contentHeaders };
    }

    const signatureHeaders = await this.createSignatureHeaders({
      request,
      privateKey,
      keyId,
    });

    return {
      ...request.headers,
      ...signatureHeaders,
    };
  }

  async initClient(walletAddressUrl: string) {
    const { privateKey, keyId } = await this.getPrivateKeyInformation();

    this.client = await createAuthenticatedClient({
      validateResponses: false,
      requestTimeoutMs: 10000,
      walletAddressUrl,
      authenticatedRequestInterceptor: async (request) => {
        if (!request.method || !request.url) {
          throw new Error('Cannot intercept request: url or method missing');
        }

        const initialRequest = request.clone();

        const headers = await this.createHeaders({
          request: {
            method: request.method,
            url: request.url,
            headers: JSON.parse(
              JSON.stringify(Object.fromEntries(request.headers)),
            ),
            body: request.body
              ? JSON.stringify(await request.json())
              : undefined,
          },
          privateKey: ed.etc.hexToBytes(privateKey),
          keyId,
        });

        if (request.body) {
          initialRequest.headers.set(
            'Content-Type',
            headers['Content-Type'] as string,
          );
          initialRequest.headers.set(
            'Content-Digest',
            headers['Content-Digest'] as string,
          );
        }

        initialRequest.headers.set('Signature', headers['Signature']);
        initialRequest.headers.set(
          'Signature-Input',
          headers['Signature-Input'],
        );

        return initialRequest;
      },
    });
  }
}

const isOpenPaymentsClientError = (error: any) =>
  error instanceof OpenPaymentsClientError;

export const isKeyRevokedError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return isInvalidClientError(error) || isSignatureValidationError(error);
};

// AUTH SERVER error
export const isInvalidClientError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 400 && error.code === 'invalid_client';
};

export const isInvalidContinuationError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 401 && error.code === 'invalid_continuation';
};

// RESOURCE SERVER error. Create outgoing payment and create quote can fail
// with: `Signature validation error: could not find key in list of client keys`
export const isSignatureValidationError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return (
    error.status === 401 &&
    error.description?.includes('Signature validation error')
  );
};

export const isTokenExpiredError = (
  error: any,
): error is OpenPaymentsClientError => {
  if (!isOpenPaymentsClientError(error)) return false;
  return isTokenInvalidError(error) || isTokenInactiveError(error);
};
export const isTokenInvalidError = (error: OpenPaymentsClientError) => {
  return error.status === 401 && error.description === 'Invalid Token';
};
export const isTokenInactiveError = (error: OpenPaymentsClientError) => {
  return error.status === 403 && error.description === 'Inactive Token';
};

// happens during quoting only
export const isNonPositiveAmountError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return (
    error.status === 400 &&
    error.description?.toLowerCase()?.includes('non-positive receive amount')
  );
};

export const isOutOfBalanceError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 403 && error.description === 'unauthorized';
};

export const isMissingGrantPermissionsError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  // providers using Rafiki <= v1.0.0-alpha.15 show "Insufficient Grant" error,
  // but Rafiki >= v1.0.0-alpha.16 shows "Inactive Token" (due to
  // https://github.com/interledger/rafiki/pull/2788)
  return (
    error.status === 403 &&
    (error.description === 'Insufficient Grant' || isTokenInactiveError(error))
  );
};

export const isInvalidReceiverError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 400 && error.description === 'invalid receiver';
};

export const isNotFoundError = (error: any) => {
  if (!isOpenPaymentsClientError(error)) return false;
  return error.status === 404;
};

export async function* pollOutgoingPayment(
  outgoingPaymentId: OutgoingPayment['id'],
  {
    grantService,
    openPaymentsService,
  }: Pick<Cradle, 'grantService' | 'openPaymentsService'>,
  {
    signal,
    maxAttempts = 10,
  }: Partial<{ signal: AbortSignal; maxAttempts: number }> = {},
): AsyncGenerator<OutgoingPayment, OutgoingPayment, void> {
  let attempt = 0;
  await sleep(OUTGOING_PAYMENT_POLLING_INITIAL_DELAY);
  while (++attempt <= maxAttempts) {
    try {
      signal?.throwIfAborted();
      const outgoingPayment =
        await openPaymentsService.client.outgoingPayment.get({
          url: outgoingPaymentId,
          accessToken: grantService.accessToken(),
        });
      yield outgoingPayment;
      if (outgoingPayment.failed && outgoingPayment.sentAmount.value === '0') {
        throw new ErrorWithKey('pay_error_outgoingPaymentFailed');
      }
      if (
        outgoingPayment.debitAmount.value === outgoingPayment.sentAmount.value
      ) {
        return outgoingPayment; // completed
      }
      signal?.throwIfAborted();
      await sleep(OUTGOING_PAYMENT_POLLING_INTERVAL);
    } catch (error) {
      if (isTokenExpiredError(error) || isMissingGrantPermissionsError(error)) {
        // TODO: We can remove the token `actions` check once we've proper RS
        // errors in place. Then we can handle insufficient grant error
        // separately clearly.
        const token = await grantService.rotateToken();
        const hasReadAccess = token.access_token.access.find(
          (e) => e.type === 'outgoing-payment' && e.actions.includes('read'),
        );
        if (!hasReadAccess) {
          throw new OpenPaymentsClientError('InsufficientGrant', {
            description: error.description,
          });
        }
      } else {
        throw error;
      }
    }
  }

  throw new ErrorWithKey('pay_warn_outgoingPaymentPollingIncomplete');
}
