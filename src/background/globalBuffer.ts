/**
 * Some dependencies reference the Node.js `Buffer` global, which doesn't exist
 * in the browser. Adding a full polyfill adds too much to bundle size. We only
 * need a subset (below), that can be built on top of `Uint8Array`.
 */

// @ts-expect-error our `from` is narrower than Uint8Array.from (fine here)
class BufferPolyfill extends Uint8Array {
  static isBuffer(value: unknown): value is BufferPolyfill {
    return value instanceof BufferPolyfill;
  }

  static alloc(size: number): BufferPolyfill {
    return new BufferPolyfill(size);
  }

  static from(
    value: string | ArrayBuffer | ArrayLike<number>,
    encoding?: string,
  ): BufferPolyfill {
    if (typeof value === 'string') {
      return encodeString(value, encoding);
    }
    return new BufferPolyfill(value);
  }

  write(value: string, offset = 0): number {
    const bytes = new TextEncoder().encode(value);
    this.set(bytes, offset);
    return bytes.length;
  }

  toString(encoding?: string): string {
    if (encoding === 'base64') {
      let binary = '';
      for (const byte of this) binary += String.fromCharCode(byte);
      return btoa(binary);
    }
    return new TextDecoder().decode(this);
  }
}

function encodeString(value: string, encoding?: string): BufferPolyfill {
  if (encoding === 'base64') {
    const binary = atob(value);
    const bytes = new BufferPolyfill(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new BufferPolyfill(new TextEncoder().encode(value));
}

// @ts-expect-error minimal Buffer shim for the browser build, see comment above
globalThis.Buffer = BufferPolyfill;
