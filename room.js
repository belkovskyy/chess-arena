const roomIdPattern = /^arena-[0-9a-f-]{36}$/;

export function roomFromHash(hash) {
  const id = new URLSearchParams(hash.slice(1)).get('room');
  return roomIdPattern.test(id ?? '') ? id : null;
}

export async function openRoom({ id, host, token, version, status, message, joined }) {
  await import('./vendor/peerjs.min.js');
  const { Peer } = window.peerjs;
  const peer = host ? new Peer(id, { secure: true }) : new Peer({ secure: true });
  let connection;
  let guestToken;
  let handshakeTimer;
  let closed = false;
  let serverReady = false;

  function report(state, text) {
    if (!closed) status(state, text);
  }

  function clearHandshake() {
    clearTimeout(handshakeTimer);
  }

  function waitForConnection(next) {
    const previous = connection;
    connection = next;
    previous?.close();
    clearHandshake();
    handshakeTimer = setTimeout(() => {
      if (connection !== next) return;
      report('lost', 'Не удалось соединиться. Попробуйте ещё раз.');
      connection = null;
      next.close();
    }, 18000);

    next.on('open', () => {
      if (closed || connection !== next) return;
      clearHandshake();
      joined();
    });
    next.on('data', data => {
      if (closed || connection !== next || typeof data !== 'string') return;
      let decoded;
      try { decoded = JSON.parse(data); } catch { return; }
      message(decoded);
    });
    function lost() {
      if (connection !== next) return;
      clearHandshake();
      connection = null;
      report('lost', 'Связь с другом потеряна.');
    }
    next.on('close', lost);
    next.on('error', lost);
  }

  function dial() {
    if (closed || host || !serverReady || connection) return;
    report('connecting', 'Подключаемся к комнате…');
    const next = peer.connect(id, {
      reliable: true, metadata: { version, token },
    });
    if (next) waitForConnection(next);
    else report('lost', 'Не удалось открыть соединение.');
  }

  handshakeTimer = setTimeout(() => report('error', 'Сервис подключения не ответил. Открой комнату заново.'), 12000);
  peer.on('open', () => {
    if (closed) return;
    serverReady = true;
    clearHandshake();
    if (connection?.open) return;
    if (host) report('waiting', 'Комната открыта. Отправь ссылку другу и оставь вкладку открытой.');
    else dial();
  });
  peer.on('connection', next => {
    if (!host || closed) { next.close(); return; }
    const data = next.metadata;
    if (data?.version !== version || typeof data.token !== 'string' || data.token.length !== 36
        || (guestToken && data.token !== guestToken)
        || (connection && !guestToken)) {
      next.on('open', () => {
        next.send(JSON.stringify({ type: 'refused', reason: data?.version === version ? 'Место уже занято.' : 'Обновите страницу игры.' }));
        setTimeout(() => next.close(), 500);
      });
      return;
    }
    next.on('open', () => { if (connection === next) guestToken = data.token; });
    waitForConnection(next);
  });
  peer.on('error', error => {
    clearHandshake();
    if (error.type === 'peer-unavailable') {
      const pending = connection;
      connection = null;
      pending?.close();
      report('lost', 'Комната пока недоступна. Проверь, открыта ли она у друга.');
    } else if (!connection?.open) {
      report('error', 'Не удалось подключиться к сервису комнат.');
    }
  });
  peer.on('disconnected', () => {
    serverReady = false;
    if (!closed && !peer.destroyed) peer.reconnect();
  });

  return {
    send(data) {
      if (!connection?.open) return false;
      connection.send(JSON.stringify(data));
      return true;
    },
    retry() {
      if (connection?.open) return;
      const previous = connection;
      connection = null;
      previous?.close();
      dial();
    },
    close() {
      closed = true;
      clearHandshake();
      peer.destroy();
    },
  };
}
