import { sleep } from '@/shared/helpers';

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

export function getActiveWallet() {
  let activeWallet: Record<string, unknown> | null = null;
  try {
    activeWallet = JSON.parse(
      window.localStorage.getItem('activeWallet') || 'null',
    );
  } catch {}

  if (
    typeof activeWallet === 'object' &&
    activeWallet &&
    typeof activeWallet.address === 'string' &&
    activeWallet.address &&
    activeWallet.walletType === 'Hosted'
  ) {
    return {
      address: activeWallet.address,
      walletType: activeWallet.walletType,
    };
  }

  return null;
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
