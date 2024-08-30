import type { BrowserContext, Worker } from '@playwright/test';

// TODO: add browserName param
export async function openPopup(
  context: BrowserContext,
  background: Worker,
  extensionId: string,
) {
  // load a page from which to open the extension popup, make it the active tab
  const page = await context.newPage();
  const popup = await context.newPage();

  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);

  await background.evaluate(async () => {
    // @ts-expect-error TODO
    chrome.action.openPopup();
  });

  await page.bringToFront();
  return {
    page: page,
    popup: popup,
  };
}
