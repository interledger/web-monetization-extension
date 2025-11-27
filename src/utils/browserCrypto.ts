// src/utils/browserCrypto.ts
/**
 * Minimal wrapper around the browser's Web Crypto API to replace
 * `crypto-browserify` for browser builds.
 *
 * This file intentionally implements a small subset of the Node `crypto`
 * API surface that the extension needs:
 *  - randomBytes(size): Uint8Array | Buffer (if Buffer is present)
 *  - createHash(algorithm): { update(data), digest(encoding?) } (digest is async)
 *  - subtle: proxy to crypto.subtle (for direct usages)
 *
 * If you need more features (HMAC, PBKDF2, RSA/ECDSA transforms), we can
 * extend this wrapper. Any unsupported operations will throw a clear error.
 */

function ensureCryptoAvailable() {
    if (typeof globalThis.crypto === 'undefined') {
        throw new Error(
            'Web Crypto API (globalThis.crypto) is not available in this environment.',
        );
    }
    if (typeof globalThis.crypto.subtle === 'undefined') {
        // Some very old browsers expose getRandomValues but not subtle
        // — surface a descriptive error.
        throw new Error('Web Crypto Subtle API is not available in this environment.');
    }
}

function toUint8Array(data: unknown): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof data === 'string') {
        // treat as utf-8 string
        return new TextEncoder().encode(data);
    }
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    throw new TypeError('Unsupported data type for crypto operation');
}

function toHex(buffer: ArrayBuffer) {
    const u8 = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < u8.length; i++) {
        const h = u8[i].toString(16).padStart(2, '0');
        hex += h;
    }
    return hex;
}

function toBufferMaybe(u8: Uint8Array) {
    // If Buffer exists (node-like env), return a Buffer; otherwise return Uint8Array
    // Note: many browser code paths accept Uint8Array; adapt as needed.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof (globalThis as any).Buffer !== 'undefined') {
        // @ts-ignore
        return (globalThis as any).Buffer.from(u8);
    }
    return u8;
}

export function randomBytes(size: number): Uint8Array | unknown {
    if (typeof size !== 'number' || size < 0) {
        throw new TypeError('size must be a non-negative number');
    }
    if (typeof globalThis.crypto?.getRandomValues !== 'function') {
        throw new Error('crypto.getRandomValues is not available in this environment.');
    }
    const u8 = new Uint8Array(size);
    globalThis.crypto.getRandomValues(u8);
    return toBufferMaybe(u8);
}

/**
 * createHash(algorithm) — returns an object with update() and digest(encoding?)
 * The digest() is async and returns a Promise which resolves:
 *  - if encoding === 'hex' -> string hex
 *  - otherwise -> Uint8Array (or Buffer if Buffer available)
 *
 * Supported algorithms: 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512' (case-insensitive)
 */
export function createHash(algorithm = 'sha256') {
    const algo = algorithm.toUpperCase().replace('-', '');
    const chunks: Uint8Array[] = [];

    return {
        update(data: unknown) {
            chunks.push(toUint8Array(data));
            return this;
        },
        async digest(encoding?: 'hex' | 'utf8' | undefined) {
            ensureCryptoAvailable();
            const totalLen = chunks.reduce((s, c) => s + c.byteLength, 0);
            const buffer = new Uint8Array(totalLen);
            let offset = 0;
            for (const c of chunks) {
                buffer.set(c, offset);
                offset += c.byteLength;
            }

            // Map common algorithm names to WebCrypto acceptable ones
            let webAlgo: AlgorithmIdentifier;
            switch (algo) {
                case 'SHA1':
                    webAlgo = 'SHA-1';
                    break;
                case 'SHA256':
                    webAlgo = 'SHA-256';
                    break;
                case 'SHA384':
                    webAlgo = 'SHA-384';
                    break;
                case 'SHA512':
                    webAlgo = 'SHA-512';
                    break;
                default:
                    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
            }

            const digest = await globalThis.crypto.subtle.digest(webAlgo, buffer);
            if (encoding === 'hex') {
                return toHex(digest);
            }
            return toBufferMaybe(new Uint8Array(digest));
        },
    };
}

/**
 * Export subtle for direct usages (if any). This lets code that wants to
 * call crypto.subtle directly do so as `import { subtle } from 'crypto'`
 * (if they import the module default), or via the resolved `crypto` object.
 */
export const subtle = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto.subtle : undefined;

export default {
    randomBytes,
    createHash,
    subtle,
};
