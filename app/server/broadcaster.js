'use strict';

/**
 * Broadcaster: 서버 내부 이벤트를 WebSocket 클라이언트에 브로드캐스트
 * - 연결된 모든 WebSocket 클라이언트에 JSON 메시지 전송
 */
class Broadcaster {
  constructor() {
    // Set<WebSocket>
    this._clients = new Set();
  }

  /** WebSocket 클라이언트 등록 */
  addClient(ws) {
    this._clients.add(ws);
    ws.on('close', () => this._clients.delete(ws));
    ws.on('error', () => this._clients.delete(ws));
  }

  /** 연결된 클라이언트 수 */
  get clientCount() {
    return this._clients.size;
  }

  /**
   * 모든 클라이언트에 메시지 브로드캐스트
   * @param {string} type  이벤트 타입
   * @param {object} data  페이로드
   */
  broadcast(type, data = {}) {
    if (this._clients.size === 0) return;
    const msg = JSON.stringify({ type, data, ts: Date.now() });
    for (const client of this._clients) {
      try {
        if (client.readyState === 1 /* OPEN */) {
          client.send(msg);
        }
      } catch {
        this._clients.delete(client);
      }
    }
  }

  /**
   * 특정 클라이언트에만 메시지 전송
   * @param {WebSocket} ws
   * @param {string} type
   * @param {object} data
   */
  sendTo(ws, type, data = {}) {
    try {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type, data, ts: Date.now() }));
      }
    } catch {
      this._clients.delete(ws);
    }
  }
}

// 싱글톤
const broadcaster = new Broadcaster();
module.exports = broadcaster;
