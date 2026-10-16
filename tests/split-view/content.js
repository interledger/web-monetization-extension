const api = globalThis.browser ?? globalThis.chrome;

const pageState = () => ({
  visibilityState: document.visibilityState,
  hasFocus: document.hasFocus(),
});

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg === 'GET_PAGE_STATE') sendResponse(pageState());
});

document.addEventListener('visibilitychange', () => {
  api.runtime
    .sendMessage({ event: 'visibilitychange', ...pageState() })
    .catch(() => {});
});
