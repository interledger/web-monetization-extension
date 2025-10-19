import { keygenAsync } from '@noble/ed25519';

export async function generateEd25519KeyPair() {
  const keyPair = await keygenAsync();
  return { privateKey: keyPair.secretKey, publicKey: keyPair.publicKey };
}

export function exportJWK(key: Uint8Array, kid: string) {
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
