/**
 * WebSocket 클라이언트 — 자동 재연결 + 이벤트 버스
 */

const listeners = new Map(); // type → Set<callback>
let _ws = null;
let _reconnectTimer = null;
let _reconnectDelay = 1000;
const MAX_DELAY = 30_000;

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

function connect() {
  if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  _ws = new WebSocket(getWsUrl());

  _ws.addEventListener('open', () => {
    console.log('[ws] 연결됨');
    _reconnectDelay = 1000;
    emit('__connected', {});
  });

  _ws.addEventListener('message', (ev) => {
    try {
      const { type, data, ts } = JSON.parse(ev.data);
      emit(type, data, ts);
    } catch {
      // 파싱 실패 무시
    }
  });

  _ws.addEventListener('close', () => {
    console.warn('[ws] 연결 끊김 — 재연결 시도');
    emit('__disconnected', {});
    scheduleReconnect();
  });

  _ws.addEventListener('error', () => {
    _ws.close();
  });
}

function scheduleReconnect() {
  if (_reconnectTimer) return;
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    _reconnectDelay = Math.min(_reconnectDelay * 2, MAX_DELAY);
    connect();
  }, _reconnectDelay);
}

function emit(type, data, ts) {
  const set = listeners.get(type);
  if (set) set.forEach((cb) => cb(data, ts));
}

/**
 * 이벤트 구독
 * @param {string} type
 * @param {Function} cb
 * @returns {Function} 구독 해제 함수
 */
export function subscribe(type, cb) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(cb);
  return () => listeners.get(type)?.delete(cb);
}

// 초기 연결
connect();
