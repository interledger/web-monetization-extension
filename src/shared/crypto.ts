import * as ed from '@noble/ed25519'

export async function generateEd25519KeyPair() {
  const rawPrivateKey = ed.utils.randomPrivateKey()
  // PKCS#8 format (version + algorithm)
  // Adding these values upfront solves the future import of the key using
  // `crypto.subtle.importKey` once the WebCrypto API supports the Ed25519 algorithm.
  // prettier-ignore
  const privateKey = new Uint8Array([
    48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32,
    ...rawPrivateKey,
  ])
  const publicKey = await ed.getPublicKeyAsync(rawPrivateKey)

  return { privateKey, publicKey }
}

export function exportJWK(key: Uint8Array, kid: string) {
  const string = String.fromCharCode.apply(null, key)

  const base64 = btoa(string)
  // Based on the JWK Spec - base64url encoded.
  // https://datatracker.ietf.org/doc/html/rfc7517#section-3
  const base64Url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: base64Url,
    kid
  }
}
