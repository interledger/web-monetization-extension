import type { WalletAddress, JWKS } from '@interledger/open-payments';
import type { WalletInfo } from '@/shared/types';
import { ensureEnd } from './misc';

export function toWalletAddressUrl(s: string): string {
  if (s.startsWith('https://')) return s;

  const addr = s.replace(/^\$/, 'https://').replace(/\/$/, '');
  if (/^https:\/\/.*\/[^\/].*$/.test(addr)) {
    return addr;
  }
  return `${addr}/.well-known/pay`;
}

const isWalletAddress = (o: Record<string, unknown>): o is WalletAddress => {
  return !!(
    o.id &&
    typeof o.id === 'string' &&
    o.assetScale &&
    typeof o.assetScale === 'number' &&
    o.assetCode &&
    typeof o.assetCode === 'string' &&
    o.authServer &&
    typeof o.authServer === 'string' &&
    o.resourceServer &&
    typeof o.resourceServer === 'string'
  );
};

export const getWalletInformation = async (
  walletAddressUrl: string,
): Promise<WalletInfo> => {
  const response = await fetch(walletAddressUrl, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('This wallet address does not exist.');
    }
    throw new Error('Failed to fetch wallet address.');
  }

  const msgInvalidWalletAddress = 'Provided URL is not a valid wallet address.';
  const json = await response.json().catch((error) => {
    throw new Error(msgInvalidWalletAddress, { cause: error });
  });
  if (!isWalletAddress(json)) {
    throw new Error(msgInvalidWalletAddress);
  }

  return { ...json, url: walletAddressUrl };
};

export const getJWKS = async (walletAddressUrl: string) => {
  const jwksUrl = new URL('jwks.json', ensureEnd(walletAddressUrl, '/'));
  const res = await fetch(jwksUrl.href);
  const json = await res.json();
  return json as JWKS;
};
