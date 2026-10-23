// Try WebDriver BiDi webExtension.install in Safari.
// Start a safaridriver session with `safari:experimentalWebSocketUrl: true`
// and pass the webSocketUrl it returns.
// Usage: node safari-bidi.mjs <webSocketUrl> <path/to/dist/safari>
// biome-ignore-all lint/suspicious/noConsole: prints results
const [url, dist] = process.argv.slice(2);
const ws = new WebSocket(url);

let id = 0;
const send = (method, params) =>
  new Promise((resolve) => {
    const msgId = ++id;
    ws.addEventListener('message', function onMessage(e) {
      const msg = JSON.parse(e.data);
      if (msg.id !== msgId) return;
      ws.removeEventListener('message', onMessage);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

ws.onopen = async () => {
  console.log('status:', await send('session.status', {}));
  // Fails with "'webExtension' domain was not found".
  console.log(
    'install:',
    await send('webExtension.install', {
      extensionData: { type: 'path', path: dist },
    }),
  );
  ws.close();
};
