import type { Page } from '@playwright/test';
import type { Background } from '../fixtures/helpers';

const OPEN_PAYMENTS_REDIRECT_URL = `https://webmonetization.org/welcome`;

export async function waitForWelcomePage(page: Page) {
  await page.waitForURL(
    (url) =>
      url.href.startsWith(OPEN_PAYMENTS_REDIRECT_URL) &&
      url.searchParams.get('result') === 'grant_success',
  );
}
