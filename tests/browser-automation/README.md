# Browser automation scripts

Scripts from looking into automated testing in Safari (#1080). They aren't
part of the test suite, they're kept here for reference.

Build the extension first: `pnpm build safari`, `pnpm build chrome`,
`pnpm build firefox`.

## Safari

Tested on macOS 27 with Safari 27.0.

1. In Safari, turn on Settings > Advanced > "Show features for web developers",
   then Settings > Developer > "Allow remote automation and external agents".
2. Run `safaridriver --enable` once.
3. Run `python3 safari.py dist/safari`.

It loads the extension with safaridriver's `POST /session/{id}/webextension`,
finds its base URL from the consent page, and opens the popup. The popup shows
"Permission needed", and neither `browser.permissions.request()` nor a
WebDriver click on "Grant permission" can grant host permissions.

`safari-bidi.mjs` tries WebDriver BiDi `webExtension.install`, which Safari
doesn't support yet (WebKit bugs 288347, 288348, 288349).

## Chrome and Firefox

Tested with Chrome 156 and Firefox 158, Node 24.

```sh
npm install webdriverio@9
node webdriverio.mjs chrome dist
node webdriverio.mjs firefox dist
```

Both load the extension with BiDi `webExtension.install` and open the popup.
Firefox needs geckodriver's `allowSystemAccess` to open the `moz-extension://`
page, and the `extensions.webextensions.uuids` pref to know the extension's
UUID.
