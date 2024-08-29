import { test, expect } from './fixtures/base';
import { openPopup } from './pages/popup';

test('should load popup', async ({ page, extensionId }) => {
  await openPopup(page, extensionId);

  await expect(page).toHaveTitle('Web Monetization Extension');
  await expect(page.locator('#popup-container')).toBeAttached();
  await expect(page.locator('header')).toHaveText('Web Monetization');
  await expect(page.locator('header img')).toHaveAttribute('src', /logo\.svg$/);
});
