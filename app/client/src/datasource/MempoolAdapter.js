/**
 * MempoolAdapter — mempool.space 공개 API 어댑터
 * WebSocket: wss://mempool.space/api/v1/ws
 * REST: https://mempool.space/api/...
 */

import { EventBus } from './EventBus.js';

const WS_URL = 'wss://mempool.space/api/v1/ws';
const REST_BASE = 'https://mempool.space/api';
const REST_POLL_INTERVAL = 30_000;
const MAX_RECONNECT_DELAY = 30_000;

export class MempoolAdapter extends EventBus {
  constructor() {
    super();
    this._ws = null;
    this._reconnectTimer = null;
    this._reconnectDelay = 1000;
    this._destroyed = false;
    this._restTimer = null;

    // TX 프레임 배치용
    this._pendingTxs = [];
    this._frameScheduled = false;
    this._txTimestamps = []; // 초당 TX 카운트용

    this.connect();
    this._startRestPolling();
  }

  // ── WebSocket 연결 ──────────────────────────────────────────────────────────

  connect() {
    if (this._destroyed) return;
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) return;

    this._ws = new WebSocket(WS_URL);

    this._ws.addEventListener('open', () => {
      console.log('[MempoolAdapter] WS 연결됨');
      this._reconnectDelay = 1000;

      // 원하는 이벤트 스트림 구독 요청
      this._ws.send(JSON.stringify({ action: 'want', data: ['blocks', 'stats', 'mempool-blocks'] }));
      this._ws.send(JSON.stringify({ 'track-mempool-txids': true }));

      this.emit('__connected', {});
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
      console.warn('[MempoolAdapter] WS 연결 끊김 — 재연결 예약');
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
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, MAX_RECONNECT_DELAY);
      this.connect();
    }, this._reconnectDelay);
  }

  // ── 메시지 파싱 ─────────────────────────────────────────────────────────────

  _handleMessage(msg) {
    // 새 블록
    if (msg.block) {
      this._handleBlock(msg.block);
    }

    // mempool TX 델타
    if (msg['mempool-txids']) {
      const delta = msg['mempool-txids'];
      if (delta.added?.length) {
        this._queueTxs(delta.added);
      }
      if (delta.mined?.length) {
        this.emit('block:mined', { txids: delta.mined, count: delta.mined.length });
      }
    }

    // mempool 통계
    if (msg.mempoolInfo) {
      this.emit('mempool', {
        count: msg.mempoolInfo.size,
        vsize: msg.mempoolInfo.bytes,
      });
    }

    // 수수료
    if (msg.fees) {
      this.emit('fees', {
        fastestFee: msg.fees.fastestFee,
        halfHourFee: msg.fees.halfHourFee,
        hourFee: msg.fees.hourFee,
      });
    }

    // difficulty adjustment
    if (msg.da) {
      this.emit('difficulty', {
        progressPercent: msg.da.progressPercent,
        remainingBlocks: msg.da.remainingBlocks,
      });
    }
  }

  _handleBlock(block) {
    const data = {
      hash: block.id,
      height: block.height,
      txCount: block.tx_count,
      pool: block.extras?.pool?.name ?? null,
      feeRange: block.extras?.feeRange ?? null,
    };

    // 3단계 블록 애니메이션
    // [0ms] 블록 도착 — 외부에서 중심 노드로 비행
    this.emit('block:received', data);

    // [500ms] 검증 완료 + HUD 업데이트
    setTimeout(() => {
      if (this._destroyed) return;
      this.emit('block:validated', { ...data, merkleOk: true });
    }, 500);

    // [1000ms] 피어 전파
    setTimeout(() => {
      if (this._destroyed) return;
      this.emit('block:propagated', { ...data, merkleOk: true });
    }, 1000);
  }

  // ── TX 프레임 배치 ──────────────────────────────────────────────────────────

  _queueTxs(txids) {
    this._pendingTxs.push(...txids);
    const now = Date.now();
    this._txTimestamps.push(...txids.map(() => now));
    if (!this._frameScheduled) {
      this._frameScheduled = true;
      requestAnimationFrame(() => this._flushTxs());
    }
  }

  _flushTxs() {
    this._frameScheduled = false;
    if (this._destroyed) return;

    const batch = this._pendingTxs.splice(0);
    if (batch.length === 0) return;

    // 1프레임(16ms)에 도착한 TX를 약간의 stagger로 emit
    const stagger = Math.min(16 / batch.length, 4);
    batch.forEach((txid, i) => {
      setTimeout(() => {
        if (!this._destroyed) this.emit('tx', { txid });
      }, i * stagger);
    });

    // 초당 TX 수 계산용 타임스탬프 갱신 (1초 이전 항목 제거)
    const cutoff = Date.now() - 1000;
    this._txTimestamps = this._txTimestamps.filter((t) => t > cutoff);
    this.emit('txPerSec', { value: this._txTimestamps.length });

    // 아직 대기 TX가 있으면 다음 프레임에 처리
    if (this._pendingTxs.length > 0) {
      this._frameScheduled = true;
      requestAnimationFrame(() => this._flushTxs());
    }
  }

  // ── REST 폴링 ───────────────────────────────────────────────────────────────

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

      const latestBlock = recentBlocks[0];

      this.emit('init', {
        chain: 'mainnet',
        blocks: latestBlock?.height ?? null,
        recentBlocks: recentBlocks.map((b) => ({
          hash: b.id,
          height: b.height,
          txCount: b.tx_count,
          pool: b.extras?.pool?.name ?? null,
          feeRange: b.extras?.feeRange ?? null,
          merkleOk: true,
        })),
      });

      if (mempool) {
        this.emit('mempool', { count: mempool.count, vsize: mempool.vsize });
      }

      if (fees) {
        this.emit('fees', {
          fastestFee: fees.fastestFee,
          halfHourFee: fees.halfHourFee,
          hourFee: fees.hourFee,
        });
      }

      if (da) {
        this.emit('difficulty', {
          progressPercent: da.progressPercent,
          remainingBlocks: da.remainingBlocks,
        });
      }
    } catch (err) {
      console.warn('[MempoolAdapter] REST 폴링 실패:', err);
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
