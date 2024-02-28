import { bytesToHex } from '@noble/hashes/utils'

import { exportJWK, generateEd25519KeyPair } from '@/utils/crypto'
import { getKeys, setKeys } from '@/utils/storage'

export const generateKeysHandler = async () => {
  if (await getKeys()) return

  const { privateKey, publicKey } = generateEd25519KeyPair()
  const keyId = crypto.randomUUID()
  const jwk = exportJWK(publicKey, keyId)

  await setKeys(bytesToHex(privateKey), btoa(JSON.stringify(jwk)), keyId)
}
