import { bytesToHex } from '@noble/hashes/utils'
import { type Browser } from 'webextension-polyfill'

import { exportJWK, generateEd25519KeyPair } from '@/utils/crypto'
import { getKeys } from '@/utils/storage'

export class BrowserEventsService {
  //TO DO: add storage service
  constructor(private browser: Browser) {}

  async populateStorage() {
    if (await getKeys()) return

    const { privateKey, publicKey } = generateEd25519KeyPair()
    const keyId = crypto.randomUUID()
    const jwk = exportJWK(publicKey, keyId)

    await this.browser.storage.sync.set({
      privateKey: bytesToHex(privateKey),
      publicKey: btoa(JSON.stringify(jwk)),
      keyId,
    })
  }
}
