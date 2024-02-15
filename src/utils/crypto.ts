import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))

export function generateEd25519KeyPair() {
  const rawPrivateKey = ed.utils.randomPrivateKey()
  const privateKey = new Uint8Array([
    48,
    46,
    2,
    1,
    0,
    48,
    5,
    6,
    3,
    43,
    101,
    112,
    4,
    34,
    4,
    32,
    ...rawPrivateKey,
  ])
  const publicKey = ed.getPublicKey(rawPrivateKey)

  return { privateKey, publicKey }
}

export function exportJWK(key: Uint8Array, keyId: string) {
  const string = String.fromCharCode.apply(null, key)

  const base64 = btoa(string)
  const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: base64Url,
    kid: keyId,
  }
}
