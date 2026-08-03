export function toWalletAddressUrl(s: string): string {
  if (s.startsWith('https://')) return s;

  const addr = s.replace(/^\$/, 'https://').replace(/\/$/, '');
  if (/^https:\/\/.*\/[^/].*$/.test(addr)) {
    return addr;
  }
  return `${addr}/.well-known/pay`;
}
