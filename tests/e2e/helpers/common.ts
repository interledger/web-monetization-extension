import type { Page } from '@playwright/test';

export async function getJWKS(page: Page, jwksUrl: string) {
  type JWKS = { keys: { kid: string }[] };
  return await page.evaluate(async (jwksUrl) => {
    return await fetch(jwksUrl).then((r) => r.json() as Promise<JWKS>);
  }, jwksUrl);
}
