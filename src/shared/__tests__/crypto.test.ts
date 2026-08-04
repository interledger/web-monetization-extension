// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createContentDigestHeader,
  exportJWK,
  generateEd25519KeyPair,
} from '../crypto';

describe('generateEd25519KeyPair', () => {
  it('generates a private/public key pair of the expected sizes', async () => {
    const { privateKey, publicKey } = await generateEd25519KeyPair();
    expect(privateKey).toBeInstanceOf(Uint8Array);
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(privateKey).toHaveLength(32);
    expect(publicKey).toHaveLength(32);
  });

  it('generates a different key pair on every call', async () => {
    const a = await generateEd25519KeyPair();
    const b = await generateEd25519KeyPair();
    expect(a.publicKey).not.toEqual(b.publicKey);
    expect(a.privateKey).not.toEqual(b.privateKey);
  });
});

describe('exportJWK', () => {
  it('exports a base64url-encoded OKP/Ed25519 JWK', () => {
    const key = new Uint8Array(32).fill(1);
    expect(exportJWK(key, 'kid1')).toEqual({
      kty: 'OKP',
      crv: 'Ed25519',
      x: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
      kid: 'kid1',
    });
  });

  it('produces a base64url string without padding or unsafe characters', () => {
    // 0xfb/0xff bytes force `+`/`/`/`=` to appear in plain base64
    const key = new Uint8Array(32).fill(0xff);
    const jwk = exportJWK(key, 'kid2');
    expect(jwk.x).not.toMatch(/[+/=]/);
  });
});

describe('createContentDigestHeader', () => {
  it('returns a sha-512 Content-Digest structured-field value', async () => {
    const header = await createContentDigestHeader('hello world');
    expect(header).toBe(
      'sha-512=:MJ7MSJwS1utMxA9QyQLytNDtd+5RGnx6m808qG1M2G+YndNbxf9JlnDaNCVbRbDP2DDoH2Bdz33FVC6TrpzXbw==:',
    );
  });

  it('produces different digests for different bodies', async () => {
    const a = await createContentDigestHeader('hello world');
    const b = await createContentDigestHeader('goodbye world');
    expect(a).not.toBe(b);
  });
});
