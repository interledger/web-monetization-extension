// biome-ignore-all lint/suspicious/noConsole: this extension only logs
const api = globalThis.browser ?? globalThis.chrome;
const action = api.action ?? api.browserAction;

const log = (...args) => console.log(new Date().toISOString(), ...args);

async function logTabs(reason) {
  const tabs = await api.tabs.query({ currentWindow: true });
  const rows = await Promise.all(
    tabs.map(async (tab) => {
      const page = await api.tabs
        .sendMessage(tab.id, 'GET_PAGE_STATE', { frameId: 0 })
        .catch(() => null);
      return {
        id: tab.id,
        title: tab.title,
        active: tab.active,
        highlighted: tab.highlighted,
        splitViewId: tab.splitViewId,
        visibilityState: page?.visibilityState,
        hasFocus: page?.hasFocus,
      };
    }),
  );
  log(`tabs in current window (${reason})`);
  console.table(rows);
}

api.tabs.onActivated.addListener((info) => {
  log('tabs.onActivated', info);
  void logTabs('onActivated');
});
api.tabs.onHighlighted.addListener((info) => {
  log('tabs.onHighlighted', info);
});
api.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if ('splitViewId' in changeInfo) {
    log('tabs.onUpdated splitViewId', tabId, changeInfo.splitViewId);
  }
});
api.windows.onFocusChanged.addListener((windowId) => {
  log('windows.onFocusChanged', windowId);
});
api.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.event) log(`page ${msg.event}`, sender.tab?.id, msg);
});

// Clicking the toolbar button sets a different badge on each tab of the
// window, so you can see whether the icon follows the focused pane.
action.onClicked.addListener(async () => {
  const tabs = await api.tabs.query({ currentWindow: true });
  for (const tab of tabs) {
    await action.setBadgeText({ tabId: tab.id, text: String(tab.index + 1) });
  }
  void logTabs('toolbar button');
});
