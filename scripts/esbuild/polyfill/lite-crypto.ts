import { sha512 } from '@noble/hashes/sha2.js';

const encoder = new TextEncoder();

class Hash {
  private instance: import('@noble/hashes/utils.js').Hash<unknown>;
  private finished = false;

  constructor(algorithm: string) {
    const algo = algorithm.toLowerCase().replace(/-/g, '');
    if (algo === 'sha512') {
      this.instance = sha512.create();
    } else {
      throw new Error(`lite-crypto: ${algorithm} is not implemented.`);
    }
  }

  update(data: string | Uint8Array | ArrayBuffer, _encoding?: string): this {
    if (this.finished) throw new Error('Digest already called');

    let buffer: Uint8Array;
    if (typeof data === 'string') {
      // Node allows specifying encoding for strings (default utf8)
      buffer = encoder.encode(data);
    } else if (data instanceof ArrayBuffer) {
      buffer = new Uint8Array(data);
    } else {
      buffer = data;
    }

    this.instance.update(buffer);
    return this;
  }

  digest(encoding?: 'hex' | 'base64' | string): string | Uint8Array {
    if (this.finished) throw new Error('Digest already called');
    this.finished = true;

    const hash = this.instance.digest(); // Returns Uint8Array

    if (encoding === 'hex') {
      return Array.from(hash)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    if (encoding === 'base64') {
      return btoa(String.fromCharCode(...hash));
    }

    // Default: Return Uint8Array (Node returns a Buffer, which is a Uint8Array subclass)
    return hash;
  }
}

export const createHash = (algo: string) => {
  return new Hash(algo);
};
