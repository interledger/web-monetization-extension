import { Buffer } from 'safe-buffer';
// @ts-expect-error we know
globalThis.Buffer = Buffer;
