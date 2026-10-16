# Split view test extension

A small extension to check what browsers report for tabs shown side by side
(split view, Vivaldi's tab tiling). It was used for #1371. It logs to the
extension's background console:

- `tabs.onActivated`, `tabs.onHighlighted`, `windows.onFocusChanged`, and
  `tabs.onUpdated` when `splitViewId` changes
- a table of the current window's tabs (`active`, `highlighted`,
  `splitViewId`, and the page's `visibilityState` / `hasFocus`) on every tab
  switch
- visibility change events from pages

Clicking its toolbar button puts a different badge on each tab, to check that
the icon follows the focused pane.

## Load it

- Chromium browsers (Chrome, Edge, Brave, Vivaldi): open the extensions page,
  turn on developer mode, "Load unpacked" and pick this folder. Open the
  service worker console from the extension's card.
- Firefox: copy this folder, rename `manifest.firefox.json` to
  `manifest.json` in the copy, then load it from `about:debugging` with "Load
  Temporary Add-on". Click "Inspect" on it to see the console.

Content scripts only run in pages opened after the extension is loaded, so
open new tabs to test with.

## Test

1. Open two tabs and put them in split view with the browser's tab context
   menu (in Vivaldi, select both tabs and tile them). In Chrome 155+ you can
   also run `chrome.tabs.createSplit([tabId1, tabId2])` in the service worker
   console.
2. Click between the two panes, then switch to another app and back.
3. Click the toolbar button and switch panes again to see whether the badge
   changes.
