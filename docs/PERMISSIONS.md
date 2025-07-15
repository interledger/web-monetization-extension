# Permissions

The Web Monetization extension requires the following permissions for its basic functionality:

## [`tabs`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs)

- To monitor tabs for changes (open/close/navigate) to maintain monetization state
- Show content specific to the current tab in the extension's UI (popup)
- To get the URL of the current tab for displaying and maintaining state to prevent overpaying a website

<details>
<summary>

**Why not `activeTab` permission?**

</summary>

Because that'll require the user to click the extension icon every time they navigate to a new page to be able to send Web Monetization payments, essentially defeating the purpose of Web Monetization - passive continuous micro-payments.

</details>

## [`storage`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage)

- To persist state between browser reloads (e.g. your wallet connection information)

The state isn't synced between browsers. We only make use of `local` storage.

## [`alarms`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms)

- To keep the extension's background service worker/script running throughout the browser session, as it's expensive to reset the monetization state.
- To reset grant expiration state when the grant renews

## [`scripting`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs)

- To inject the Web Monetization polyfill into the page
- To simplify the registration of automatic key addition scripts relevant to the user's wallet.

There's no remote code execution involved here.

## [`host_permissions`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions#host_permissions)

We require access to all `https://` websites and `localhost` for the extension to work. You may see this as a warning in your browser (e.g. this extension can read/edit content from any website you visit). We require this extensive permission in order to:

- Detect and monitor Web Monetization link elements on any given page you visit via the content script.
  - We require these link elements to identify the receiving wallet addresses to be used for payments, and to inform the website about those payments via the Web Monetization JavaScript API.
- Inject the Web Monetization polyfill into any page you visit.
- Fetch the wallet address info from any domain that's provided by those link elements.

---

Note that no data other than the minimal data required by the Open Payments APIs is transmitted to any server.

All data remains within the browser only. Your browsing history isn't stored or transmitted to any server.

The Open Payments wallets do not have access to your browser history either.
