/**
 * ElectrumAdapter — Fulcrum WSS 어댑터 (커스텀 노드)
 * Electrum 프로토콜은 개별 mempool TX 스트리밍 불가
 * → 블록: Electrum 직접 수신
 * → Mempool/TX 파티클: mempool.space REST 보조 (하이브리드)
 */

import { EventBus } from './EventBus.js';

const REST_BASE = 'https://mempool.space/api';
const REST_POLL_INTERVAL = 30_000;

export class ElectrumAdapter extends EventBus {
  /**
   * @param {string} url  사용자 Fulcrum WSS URL (예: wss://mynode:50004)
   */
  constructor(url) {
    super();
    this._url = url;
    this._ws = null;
    this._destroyed = false;
    this._reconnectTimer = null;
    this._reconnectDelay = 1000;
    this._restTimer = null;
    this._msgId = 1;
    this._pendingCalls = new Map(); // id → { resolve, reject }
    this._lastKnownHeight = null;

    this.connect();
    this._startRestPolling();
  }

  // ── WebSocket 연결 ──────────────────────────────────────────────────────────

  connect() {
    if (this._destroyed) return;
    if (!this._url) {
      console.error('[ElectrumAdapter] URL이 없습니다');
      return;
    }

    try {
      this._ws = new WebSocket(this._url);
    } catch (e) {
      console.error('[ElectrumAdapter] WebSocket 생성 실패:', e);
      this._scheduleReconnect();
      return;
    }

    this._ws.addEventListener('open', () => {
      console.log('[ElectrumAdapter] WS 연결됨:', this._url);
      this._reconnectDelay = 1000;
      this._handshake();
    });

    this._ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        this._handleMessage(msg);
      } catch {
        // 파싱 실패 무시
      }
    });

    this._ws.addEventListener('close', () => {
      console.warn('[ElectrumAdapter] WS 연결 끊김 — 재연결 예약');
      this.emit('__disconnected', {});
      this._scheduleReconnect();
    });

    this._ws.addEventListener('error', () => {
      this._ws.close();
    });
  }

  _scheduleReconnect() {
    if (this._destroyed || this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, 30_000);
      this.connect();
    }, this._reconnectDelay);
  }

  // ── Electrum 프로토콜 핸드셰이크 ────────────────────────────────────────────

  async _handshake() {
    try {
      // 버전 협상
      await this._call('server.version', ['Bitcoin Node Visualizer', '1.4']);

      // 새 블록 헤더 구독
      this._send({ method: 'blockchain.headers.subscribe', params: [], id: this._msgId++ });

      this.emit('__connected', {});
    } catch (e) {
      console.error('[ElectrumAdapter] 핸드셰이크 실패:', e);
    }
  }

  _call(method, params = []) {
    return new Promise((resolve, reject) => {
      const id = this._msgId++;
      this._pendingCalls.set(id, { resolve, reject });
      this._send({ method, params, id });
      // 타임아웃 10초
      setTimeout(() => {
        if (this._pendingCalls.has(id)) {
          this._pendingCalls.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 10_000);
    });
  }

  _send(obj) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }

  // ── 메시지 파싱 ─────────────────────────────────────────────────────────────

  _handleMessage(msg) {
    // RPC 응답
    if (msg.id != null && this._pendingCalls.has(msg.id)) {
      const { resolve, reject } = this._pendingCalls.get(msg.id);
      this._pendingCalls.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }

    // 구독 알림
    if (msg.method === 'blockchain.headers.subscribe') {
      const header = Array.isArray(msg.params) ? msg.params[0] : msg.params;
      this._handleNewHeader(header);
    }
  }

  _handleNewHeader(header) {
    if (!header) return;
    const height = header.height ?? this._lastKnownHeight;
    this._lastKnownHeight = height;

    const data = {
      hash: null, // Electrum 헤더에서 별도 파싱 필요
      height,
      txCount: null,
      pool: null,
      feeRange: null,
    };

    this.emit('block:received', data);
    setTimeout(() => {
      if (!this._destroyed) this.emit('block:validated', { ...data, merkleOk: true });
    }, 500);
    setTimeout(() => {
      if (!this._destroyed) this.emit('block:propagated', { ...data, merkleOk: true });
    }, 1000);
  }

  // ── REST 보조 폴링 (mempool.space) ──────────────────────────────────────────

  async _startRestPolling() {
    await this._fetchRest();
    this._restTimer = setInterval(() => this._fetchRest(), REST_POLL_INTERVAL);
  }

  async _fetchRest() {
    if (this._destroyed) return;
    try {
      const [blocksRes, mempoolRes, feesRes, daRes] = await Promise.all([
        fetch(`${REST_BASE}/blocks`),
        fetch(`${REST_BASE}/mempool`),
        fetch(`${REST_BASE}/v1/fees/recommended`),
        fetch(`${REST_BASE}/v1/difficulty-adjustment`),
      ]);

      const recentBlocks = blocksRes.ok ? await blocksRes.json() : [];
      const mempool = mempoolRes.ok ? await mempoolRes.json() : null;
      const fees = feesRes.ok ? await feesRes.json() : null;
      const da = daRes.ok ? await daRes.json() : null;

      this.emit('init', {
        chain: 'mainnet',
        blocks: recentBlocks[0]?.height ?? this._lastKnownHeight,
        recentBlocks: recentBlocks.map((b) => ({
          hash: b.id,
          height: b.height,
          txCount: b.tx_count,
          pool: b.extras?.pool?.name ?? null,
          feeRange: b.extras?.feeRange ?? null,
          merkleOk: true,
        })),
      });

      if (mempool) this.emit('mempool', { count: mempool.count, vsize: mempool.vsize });
      if (fees) this.emit('fees', { fastestFee: fees.fastestFee, halfHourFee: fees.halfHourFee, hourFee: fees.hourFee });
      if (da) this.emit('difficulty', { progressPercent: da.progressPercent, remainingBlocks: da.remainingBlocks });
    } catch (err) {
      console.warn('[ElectrumAdapter] REST 폴링 실패:', err);
    }
  }

  // ── 정리 ────────────────────────────────────────────────────────────────────

  destroy() {
    this._destroyed = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this._restTimer) clearInterval(this._restTimer);
    if (this._ws) this._ws.close();
    this.clear();
  }
}
