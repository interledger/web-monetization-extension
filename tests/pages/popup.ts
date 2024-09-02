import type { BrowserContext } from '@playwright/test';

// TODO: add browserName param
export async function openPopup(context: BrowserContext, extensionId: string) {
  const popup = await context.newPage();
  const url = `chrome-extension://${extensionId}/popup/index.html`;
  await popup.goto(url);
  await popup.waitForLoadState("networkidle");
  return popup;
}
