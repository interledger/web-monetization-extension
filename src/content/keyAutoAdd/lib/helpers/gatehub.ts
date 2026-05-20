import { ErrorWithKey, sleep } from '@/shared/helpers';

export const getAuthToken = async (): Promise<string> => {
  let attempt = 0;
  while (++attempt < 5) {
    const auth = localStorage.getItem('auth');
    if (!auth) {
      await sleep(500);
      continue;
    }
    try {
      const data = JSON.parse(auth) as { token: { accessToken: string } };
      return data.token.accessToken;
    } catch {
      throw new Error('Failed to parse auth token');
    }
  }
  throw new Error('Failed to get auth token');
};

/**
 * @example
 * ```ts
 * walletAddressUrlToId('https://ilp.*.gatehub.net/150012576/usd')
 *  // "150012576"
 * ```
 */
export const walletAddressUrlToId = (url: string) => {
  const { pathname } = new URL(url);
  return pathname.match(/\/(\d+)/)![1];
};

export async function getUserWallets() {
  type GetWalletsResponse = Me<{
    wallets: { address: string; walletType: string; enabled: boolean }[];
  }>;

  const data = await graphQlRequest<GetWalletsResponse>({
    operationName: 'GetWallets',
    variables: { filter: { includeDeleted: false } },
    query: gql`
      query GetWallets($filter: FilterWalletsInput, $walletType: WalletType) {
        me {
          wallets(filter: $filter, walletType: $walletType) {
            address
            walletType
            enabled
          }
        }
      }
    `,
  }).catch((error) => {
    if (error instanceof GraphQlError) {
      throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound', [
        error.message,
      ]);
    }
    throw error;
  });
  return data.me.wallets;
}

export async function getUserPaymentPointers(wallet: {
  address: string;
  walletType: string;
}) {
  type GetUserPaymentPointersResponse = Me<{
    wallets: { ilpPaymentPointers: { paymentPointerUrl: string }[] }[];
  }>;

  const data = await graphQlRequest<GetUserPaymentPointersResponse>({
    operationName: 'GetUserPaymentPointers',
    variables: {
      address: wallet.address,
      walletType: wallet.walletType,
    },
    query: gql`
      query GetUserPaymentPointers($address: String!, $walletType: WalletType) {
        me {
          wallets(address: $address, walletType: $walletType) {
            ilpPaymentPointers {
              paymentPointerUrl
            }
          }
        }
      }
    `,
  }).catch((error) => {
    if (error instanceof GraphQlError) {
      throw new ErrorWithKey('connectWalletKeyService_error_accountNotFound', [
        error.message,
      ]);
    }
    throw error;
  });
  return data.me;
}

// For syntax highlighting
export const gql = String.raw;

export async function graphQlRequest<R>(body: {
  operationName: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<R> {
  const url = new URL('/graphql', location.origin.replace('wallet.', 'api.'));
  const authToken = await getAuthToken();

  const res = await fetch(url.href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    credentials: 'include',
    body: JSON.stringify(body),
  }).catch((error) => {
    return Response.json(null, { status: 599, statusText: error.message });
  });
  if (!res.ok) {
    throw new Error(`API request failed (${res.statusText})`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    throw new GraphQlError(json.errors[0].message, json.errors);
  }
  return json.data as R;
}

type Me<Data> = { me: Data };

export class GraphQlError extends Error {
  public readonly errors: {
    message: string;
    path: string[];
    extensions: { code: string; message: string; status: number };
  }[] = [];

  constructor(message: string, errors: GraphQlError['errors']) {
    super(message);
    this.name = 'GraphQlError';
    this.errors = errors;
  }
}
