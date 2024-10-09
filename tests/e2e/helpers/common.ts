import type { Page } from '@playwright/test';
import type { Background } from '../fixtures/helpers';

const OPEN_PAYMENTS_REDIRECT_URL = `https://webmonetization.org/welcome`;

export async function getJWKS(ctx: Page | Background, jwksUrl: string) {
  type JWKS = { keys: { kid: string }[] };
  return await ctx.evaluate(async (jwksUrl) => {
    return await fetch(jwksUrl).then((r) => r.json() as Promise<JWKS>);
  }, jwksUrl);
}

export async function waitForWelcomePage(page: Page) {
  await page.waitForURL(
    (url) =>
      url.href.startsWith(OPEN_PAYMENTS_REDIRECT_URL) &&
      url.searchParams.get('result') === 'grant_success',
  );
}
