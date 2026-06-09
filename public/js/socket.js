export function initWebSocket(onMessage) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('[WebSocket] Connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error('[WebSocket] Error parsing message', err);
    }
  };

  ws.onclose = () => {
    console.log('[WebSocket] Disconnected. Reconnecting in 3s...');
    setTimeout(() => initWebSocket(onMessage), 3000);
  };

  return ws;
}
