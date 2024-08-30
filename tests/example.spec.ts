import { test, expect } from './fixtures/base';
import { openPopup } from './pages/popup';

test('should load popup', async ({ context, background, extensionId }) => {
  const { popup } = await openPopup(context, background, extensionId);

  await expect(popup).toHaveTitle('Web Monetization Extension');
  await expect(popup.locator('#popup-container')).toBeAttached();
  await expect(popup.locator('header')).toHaveText('Web Monetization');
  await expect(popup.locator('header img')).toHaveAttribute(
    'src',
    /logo\.svg$/,
  );
});

test('shows connect form if not connected', async ({
  context,
  background,
  extensionId,
}) => {
  const { page, popup } = await openPopup(context, background, extensionId);

  await page.goto('https://example.com');

  await expect(popup).toHaveTitle('Web Monetization Extension');
  await expect(popup.locator('#popup-container')).toBeAttached();
  await expect(popup.locator('header')).toHaveText('Web Monetization');
  await expect(popup.locator('header img')).toHaveAttribute(
    'src',
    /logo\.svg$/,
  );

  await expect(popup.locator('form')).toBeVisible();
  await expect(popup.locator('form button[type="submit"]')).toBeVisible();
  await expect(popup.locator('form button[type="submit"]')).toHaveText(
    'Connect',
  );
});
