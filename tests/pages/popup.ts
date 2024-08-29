import { Page } from '@playwright/test';

// TODO: add browserName param
export async function openPopup(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
}
