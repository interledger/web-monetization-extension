# Install the Web Monetization Extension

While you typically install the Web Monetization extension directly from your [browser's extension store](https://webmonetization.org/supporters/get-started/#install-the-extension), you might need to install a different build for development or testing. This guide explains how to temporarily install the extension from its source code or from pre-built ZIP files.

## Install from Source

To temporarily install the extension from source, follow these steps:

### Chromium-Based Browsers (Chrome, Edge, Brave, etc.)

1. **Build the extension:** Run `pnpm build chrome` for a production build, or `pnpm dev chrome` for a development build.

1. **Open the Extensions page:**
   In Chrome, click the three dots (⋮) in the top-right corner, then navigate to **Extensions > Manage extensions**.

   Alternatively, open `chrome://extensions` in the address bar.

1. **Enable Developer mode:** Toggle the Developer mode switch in the top-right corner of the Extensions page.

1. **Load the unpacked extension:**
   1. Click the **Load unpacked** _button that appears_ in the top-left.
   1. Browse to the `dist/chrome` **folder** (for production builds) or `dev/chrome` folder (for development builds) and select it. This folder contains the `manifest.json` file.

The UI might be slightly different for different browsers (Chrome, Opera, Edge, Brave, Arc, Vivaldi etc.), but the process is the same.

### Firefox

1. **Build the extension:** Run `pnpm build firefox` for a production build, or `pnpm dev firefox` for a development build.

1. **Open Firefox's Add-ons page:**
   1. Click the three horizontal lines (≡) in the top-right corner, then choose **Add-ons and themes**.
   1. Navigate to Debug Add-ons: On the Add-ons page, click the gear icon (⚙️) and select **Debug Add-ons**.

   Alternatively, open `about:debugging#/runtime/this-firefox` in the address bar.

1. **Load temporary add-on:**
   1. Expand the **Temporary Extensions** section.
   1. Click the **Load Temporary Add-on...** button.
   1. Browse to the `dist/firefox` folder (for production builds) or `dev/firefox` folder (for development builds), and select the `manifest.json` **file** inside.

### Safari

1. **Build the extension:** Run `pnpm build safari` for a production build, or `pnpm dev safari` for a development build.

1. **Enable the Developer Tab**:
   1. Open **Safari > Settings...**.
   1. Go to the **Developer** tab. If you don't see it, go to the **Advanced** tab and check "**Show features for web developers.**"

1. **Allow Unsigned Extensions** (if prompted) [[docs](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension#Configure-Safari-in-macOS-to-run-unsigned-extensions)]:
   - When you attempt to add a temporary extension, Safari may present an authentication prompt for unsigned extensions. Respond to this prompt.
   - Alternatively, you can preemptively enable "**Allow unsigned extensions**" from the **Developer** tab in Safari Settings. Note that this setting resets when you quit Safari.

1. **Add Temporary Extension**:
   1. In the **Developer** tab (in settings), click "**Add Temporary Extension...**"
   1. Locate and select the **folder** containing `manifest.json` (`dist/safari` for production builds, `dev/safari` for development builds).

### Firefox on Android

Detailed instructions are available at [Firefox Extension Workshop](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/).

1. **Build the extension:** Run `pnpm build firefox` for a production build, or `pnpm dev firefox` for a development build.
1. **Enable USB debugging on your Android device:**
   This is usually found in **Settings > Developer options > USB debugging** ([docs](https://developer.android.com/studio/debug/dev-options)).
1. **Enable USB debugging in Firefox Android:**
   1. Open Firefox on your Android device, go to **Settings > Advanced**, and
   1. Enable **Remote debugging via USB**.
   1. You may need to restart Firefox after enabling this option.
1. Connect your Android device to your computer via a USB cable..
1. Install [`web-ext`](https://github.com/mozilla/web-ext) and [`adb`](https://developer.android.com/tools/releases/platform-tools).
1. Find your Android device ID:
   ```bash
   $ adb devices
   #  List of devices attached
   #  001793554000841 device
   #  ^YOUR_DEVICE_ID
   ```
1. Run `web-ext run` with the source being `dist/firefox` directory (for production builds) or `dev/firefox` directory (for development builds); and target as `firefox-android`.
   ```bash
   web-ext run -s /path/to/ext-with-manifest-file -t firefox-android --adb-device=YOUR_DEVICE_ID
   # web-ext run -s ./dev/firefox/ -t firefox-android --adb-device=001793554000841
   ```
1. The extension should now be installed and running in Firefox Android.
   - You can open `about:debugging` page on your computer's Firefox, and **Connect** to your Android device and inspect the extension.
   - On your Android device, you can see the extension listed in under **Menu > Extensions**. You can access the extension's UI page from there.

## Install Pre-built Versions

You can also install pre-built versions, such as [nightly builds](https://github.com/interledger/web-monetization-extension/releases/tag/nightly) or any .zip files from the [releases page](https://github.com/interledger/web-monetization-extension/releases). These are ready to use and don't require a development environment.

The installation process is similar to installing from source, with one key difference:

- Instead of selecting a `dist` or `dev` folder, you'll load the relevant `.zip` file.
- For **Chromium-based browsers and Firefox on Android, you must first extract (unzip) the `.zip` file** before loading it using the **Load unpacked** option. For Firefox (desktop), you can select the `.zip` file directly.
