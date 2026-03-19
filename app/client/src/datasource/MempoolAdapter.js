/**
 * MempoolAdapter — mempool.space (또는 커스텀 Mempool 인스턴스) API 어댑터
 * WebSocket: wss://mempool.space/api/v1/ws
 * REST: https://mempool.space/api/...
 */

import { EventBus } from './EventBus.js';

const DEFAULT_BASE = 'https://mempool.space';
const REST_POLL_INTERVAL = 30_000;
const MAX_RECONNECT_DELAY = 30_000;

export class MempoolAdapter extends EventBus {
  constructor(baseUrl = '') {
    super();
    const base = (baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    const isSecure = base.startsWith('https');
    this._wsUrl = `${isSecure ? 'wss' : 'ws'}://${base.replace(/^https?:\/\//, '')}/api/v1/ws`;
    this._restBase = `${base}/api`;

    this._ws = null;
    this._reconnectTimer = null;
    this._reconnectDelay = 1000;
    this._destroyed = false;
    this._restTimer = null;

    // TX 프레임 배치용
    this._pendingTxs = [];
    this._frameScheduled = false;
    this._txTimestamps = []; // 초당 TX 카운트용

    // 수수료 캐시 (TX 합성 데이터용)
    this._currentFees = { fastestFee: 15, halfHourFee: 8, hourFee: 3 };

    this.connect();
    this._startRestPolling();
  }

  // ── WebSocket 연결 ──────────────────────────────────────────────────────────

  connect() {
    if (this._destroyed) return;
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) return;

    this._ws = new WebSocket(this._wsUrl);

    this._ws.addEventListener('open', () => {
      console.log('[MempoolAdapter] WS 연결됨');
      this._reconnectDelay = 1000;

      // 원하는 이벤트 스트림 구독 요청
      this._ws.send(JSON.stringify({ action: 'want', data: ['blocks', 'stats', 'mempool-blocks'] }));
      // mempool TX 델타 추적 요청
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
    // mempool TX 델타 — 블록 이벤트보다 먼저 처리해서 minedCount를 블록에 포함
    let minedCount = 0;
    if (msg['mempool-txids']) {
      const delta = msg['mempool-txids'];

      if (delta.added?.length) {
        this._queueTxs(delta.added);
      }
      if (delta.mined?.length) {
        minedCount = delta.mined.length;
        this.emit('block:mined', { txids: delta.mined, count: minedCount });
      }
      if (delta.removed?.length) {
        // mempool에서 만료/수수료 부족으로 제거된 TX
        this.emit('tx:removed', { count: delta.removed.length });
      }
      if (delta.replaced?.length) {
        // RBF 교체된 TX
        this.emit('tx:replaced', { count: delta.replaced.length });
      }
    }

    // 새 블록 — minedCount와 함께 처리
    if (msg.block) {
      this._handleBlock(msg.block, minedCount);
    }

    // mempool-blocks (수수료 분포 데이터)
    if (msg['mempool-blocks']) {
      this.emit('mempool:blocks', msg['mempool-blocks']);
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
      this._currentFees = {
        fastestFee: msg.fees.fastestFee,
        halfHourFee: msg.fees.halfHourFee,
        hourFee: msg.fees.hourFee,
      };
      this.emit('fees', { ...this._currentFees });
    }

    // difficulty adjustment
    if (msg.da) {
      this.emit('difficulty', {
        progressPercent: msg.da.progressPercent,
        remainingBlocks: msg.da.remainingBlocks,
      });
    }
  }

  _generateSyntheticTxids(count = 8) {
    return Array.from({ length: count }, () =>
      Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
      ).join('')
    );
  }

  _handleBlock(block, minedCount = 0) {
    const txidSample = this._generateSyntheticTxids(8);

    const data = {
      hash: block.id,
      height: block.height,
      txCount: block.tx_count,
      pool: block.extras?.pool?.name ?? null,
      feeRange: block.extras?.feeRange ?? null,
      minedCount,
      // 블록 헤더 필드
      version: block.version ?? null,
      time: block.timestamp ?? null,
      nBits: block.bits != null ? block.bits.toString(16) : null,
      nonce: block.nonce ?? null,
      weight: block.weight ?? null,
      // 머클 트리
      merkleRoot: block.merkle_root ?? block.extras?.merkle_root ?? null,
      txidSample,
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
        if (!this._destroyed) this.emit('tx', this._synthesizeTxData(txid));
      }, i * stagger);
    });

    // 초당 TX 수 계산 (1초 이전 항목 제거)
    const cutoff = Date.now() - 1000;
    this._txTimestamps = this._txTimestamps.filter((t) => t > cutoff);
    this.emit('txPerSec', { value: this._txTimestamps.length });

    // 아직 대기 TX가 있으면 다음 프레임에 처리
    if (this._pendingTxs.length > 0) {
      this._frameScheduled = true;
      requestAnimationFrame(() => this._flushTxs());
    }
  }

  // ── TX 데이터 합성 (weight/feeRate) ─────────────────────────────────────────

  _synthesizeTxData(txid) {
    const { fastestFee, halfHourFee, hourFee } = this._currentFees;
    const r = Math.random();

    // 수수료율 확률 분포: 10% fast, 30% halfHour, 40% hour, 20% low
    let feeRate;
    if (r < 0.10) {
      feeRate = fastestFee + Math.floor(Math.random() * fastestFee * 0.5);
    } else if (r < 0.40) {
      feeRate = halfHourFee + Math.floor(Math.random() * (fastestFee - halfHourFee));
    } else if (r < 0.80) {
      feeRate = hourFee + Math.floor(Math.random() * (halfHourFee - hourFee));
    } else {
      feeRate = Math.max(1, hourFee - Math.floor(Math.random() * 3));
    }

    // weight 분포: 50% 400-800, 30% 800-2000, 20% 2000-8000 WU
    const wr = Math.random();
    let weight;
    if (wr < 0.50) {
      weight = 400 + Math.floor(Math.random() * 400);
    } else if (wr < 0.80) {
      weight = 800 + Math.floor(Math.random() * 1200);
    } else {
      weight = 2000 + Math.floor(Math.random() * 6000);
    }

    const vsize = Math.ceil(weight / 4);
    const fee = feeRate * vsize;
    // vin/vout 추정: weight 기반
    const vin = weight < 600 ? 1 : weight < 1500 ? Math.ceil(Math.random() * 3) : Math.ceil(Math.random() * 5) + 1;
    const vout = Math.max(1, Math.ceil(Math.random() * 3));

    return { txid, weight, vsize, fee, feeRate, vin, vout };
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
        fetch(`${this._restBase}/blocks`),
        fetch(`${this._restBase}/mempool`),
        fetch(`${this._restBase}/v1/fees/recommended`),
        fetch(`${this._restBase}/v1/difficulty-adjustment`),
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
          minedCount: null,
          // 블록 헤더 필드
          version: b.version ?? null,
          time: b.timestamp ?? null,
          nBits: b.bits != null ? b.bits.toString(16) : null,
          nonce: b.nonce ?? null,
          weight: b.weight ?? null,
          merkleRoot: b.merkle_root ?? b.extras?.merkle_root ?? null,
          txidSample: this._generateSyntheticTxids(8),
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
