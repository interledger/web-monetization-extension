import type { BrowserContext } from '@playwright/test';

export async function openPopup(
  context: BrowserContext,
  browserType: string,
  extensionId: string,
) {
  const popup = await context.newPage();
  let url: string;
  if (browserType === 'chromium') {
    url = `chrome-extension://${extensionId}/popup/index.html`;
  } else if (browserType === 'firefox') {
    url = `moz-extension://${extensionId}/popup/index.html`;
  } else {
    throw new Error('Unsupported browser: ' + browserType);
  }
  await popup.goto(url);
  return popup;
}
