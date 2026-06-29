import { keygenAsync } from '@noble/ed25519';
import { serializeDictionary } from 'structured-headers';

export async function generateEd25519KeyPair() {
  const keyPair = await keygenAsync();
  return { privateKey: keyPair.secretKey, publicKey: keyPair.publicKey };
}

export function exportJWK(key: Uint8Array, kid: string) {
  // @ts-expect-error TODO
  const string = String.fromCharCode.apply(null, key);

  const base64 = btoa(string);
  // Based on the JWK Spec - base64url encoded.
  // https://datatracker.ietf.org/doc/html/rfc7517#section-3
  const base64Url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: base64Url,
    kid,
  };
}

export async function createContentDigestHeader(body: string): Promise<string> {
  const data = new TextEncoder().encode(body);
  const hash = await crypto.subtle.digest('SHA-512', data);
  return serializeDictionary({ 'sha-512': [hash, new Map()] });
}
