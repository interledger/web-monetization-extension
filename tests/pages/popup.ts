import type { BrowserContext } from '@playwright/test';

export async function openPopup(
  context: BrowserContext,
  browserName: string,
  extensionId: string,
) {
  const popup = await context.newPage();
  const url = getPopupUrl(browserName, extensionId);
  await popup.goto(url);
  return popup;
}

function getPopupUrl(browserName: string, extensionId: string) {
  let url: string;
  if (browserName === 'chromium') {
    url = `chrome-extension://${extensionId}/popup/index.html`;
  } else if (browserName === 'firefox') {
    url = `moz-extension://${extensionId}/popup/index.html`;
  } else {
    throw new Error('Unsupported browser: ' + browserName);
  }
  return url;
}
