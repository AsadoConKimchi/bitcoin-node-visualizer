/**
 * ServerAdapter — app/server/ WebSocket + REST에 연결하는 어댑터
 * Jin의 Bitcoin Core/Knots 풀노드 직접 연결용
 * MempoolAdapter와 동일한 EventBus 인터페이스 구현
 */

import { EventBus } from './EventBus.js';

export class ServerAdapter extends EventBus {
  /**
   * @param {string} serverUrl  예: 'http://100.x.x.x:3000'
   */
  constructor(serverUrl) {
    super();
    this._url = (serverUrl || '').replace(/\/$/, '');
    this._ws = null;
    this._reconnectDelay = 1000;   // 초기 재연결 대기 (1초)
    this._maxDelay = 30000;         // 최대 재연결 대기 (30초)
    this._connectTimer = null;
    this._pollTimer = null;
    this._destroyed = false;
    this._firstPoll = true;

    this._connect();
    // 첫 REST 폴링: WebSocket init보다 약간 늦게 실행
    this._pollTimer = setTimeout(() => this._poll(), 2000);
    // 저빈도 폴링 (UTXO 5분, 스토리지/보안 60초)
    this._slowPollTimer = null;
    this._medPollTimer = null;
    this._startSlowPolls();
  }

  _startSlowPolls() {
    // UTXO 통계 — 5분 간격
    const pollUtxo = async () => {
      if (this._destroyed) return;
      try {
        const res = await fetch(this._restUrl('/api/utxo-stats'));
        if (res.ok) {
          const data = await res.json();
          if (!data.error) this.emit('utxoStats', data);
        }
      } catch (_) {}
      if (!this._destroyed) {
        this._slowPollTimer = setTimeout(pollUtxo, 300_000);
      }
    };
    this._slowPollTimer = setTimeout(pollUtxo, 5000);

    // 스토리지 + 보안 — 60초 간격
    const pollMed = async () => {
      if (this._destroyed) return;
      try {
        const [storageRes, securityRes] = await Promise.allSettled([
          fetch(this._restUrl('/api/storage')),
          fetch(this._restUrl('/api/security')),
        ]);
        if (storageRes.status === 'fulfilled' && storageRes.value.ok) {
          const data = await storageRes.value.json();
          if (!data.error) this.emit('storageInfo', data);
        }
        if (securityRes.status === 'fulfilled' && securityRes.value.ok) {
          const data = await securityRes.value.json();
          if (!data.error) this.emit('securityInfo', data);
        }
      } catch (_) {}
      if (!this._destroyed) {
        this._medPollTimer = setTimeout(pollMed, 60_000);
      }
    };
    this._medPollTimer = setTimeout(pollMed, 3000);
  }

  // WebSocket URL 변환 (http → ws, https → wss)
  // this._url이 빈 문자열이면 same-origin 모드
  _wsUrl() {
    if (this._url) return this._url.replace(/^http/, 'ws') + '/ws';
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  // REST fetch URL 생성 (same-origin이면 상대경로)
  _restUrl(path) {
    return this._url ? `${this._url}${path}` : path;
  }

  _connect() {
    if (this._destroyed) return;

    // 10초 연결 타임아웃
    let timeoutId = setTimeout(() => {
      if (this._ws && this._ws.readyState === WebSocket.CONNECTING) {
        this._ws.close();
      }
    }, 10000);

    const ws = new WebSocket(this._wsUrl());
    this._ws = ws;

    ws.onopen = () => {
      clearTimeout(timeoutId);
      this._reconnectDelay = 1000; // 성공 시 딜레이 리셋
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (_) {
        // 파싱 실패 무시
      }
    };

    ws.onclose = () => {
      clearTimeout(timeoutId);
      this.emit('__disconnected', {});
      if (!this._destroyed) {
        this._scheduleReconnect();
      }
    };

    ws.onerror = () => {
      clearTimeout(timeoutId);
      ws.close();
    };
  }

  /**
   * 서버 WebSocket 이벤트 → EventBus 이벤트 매핑
   * 메시지 형식: { type, data, ts }
   */
  _handleMessage({ type, data }) {
    switch (type) {
      case 'connected':
        this.emit('__connected', data); // data = { mode }
        break;
      case 'init':
        // 서버 init: { chain, blocks, bestBlockHash, mode }
        this.emit('init', data);
        break;
      case 'tx':
        // 서버 tx: { txid, vin, vout, size }
        this.emit('tx', data);
        break;
      case 'block:received':
        this.emit('block:received', data);
        break;
      case 'block:validated':
        // 실제 Merkle 검증 결과 포함: { merkleOk, ... }
        this.emit('block:validated', data);
        break;
      case 'block:propagated':
        this.emit('block:propagated', data);
        break;
      case 'mempool':
        this.emit('mempool', data);
        break;
      case 'status':
        this.emit('serverMode', data);
        break;
      default:
        // 알 수 없는 이벤트 무시
        break;
    }
  }

  _scheduleReconnect() {
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxDelay);
    this._connectTimer = setTimeout(() => this._connect(), this._reconnectDelay);
  }

  // REST API 폴링 (30초 간격)
  async _poll() {
    if (this._destroyed) return;

    try {
      const [infoRes, mempoolRes, peersRes, mempoolInfoRes, chaintipsRes, feesRes] = await Promise.allSettled([
        fetch(this._restUrl('/api/info')),
        fetch(this._restUrl('/api/mempool')),
        fetch(this._restUrl('/api/peers')),
        fetch(this._restUrl('/api/mempool/info')),
        fetch(this._restUrl('/api/chaintips')),
        fetch(this._restUrl('/api/fees')),
      ]);

      if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
        const info = await infoRes.value.json();
        // 블록 높이, 체인 업데이트
        if (info.blocks != null || info.chain) {
          this.emit('init', { chain: info.chain, blocks: info.blocks });
        }
        // DA 진행률 (서버에서 계산)
        if (info.difficultyAdjustment) {
          this.emit('difficulty', info.difficultyAdjustment);
        }
        // 노드 메타데이터 (확장: 피어 유형, 보안, 시간)
        if (info.connections != null) {
          this.emit('nodeInfo', {
            connections: info.connections,
            version: info.version,
            subversion: info.subversion,
            peerCount: info.peerCount,
            peerTypes: info.peerTypes,
            inbound: info.inbound,
            outbound: info.outbound,
            v2Transport: info.v2Transport,
            medianTimeOffset: info.medianTimeOffset,
            localServices: info.localServices,
            networks: info.networks,
            torPeers: info.torPeers,
            i2pPeers: info.i2pPeers,
            verificationProgress: info.verificationProgress,
            pruned: info.pruned,
            sizeOnDisk: info.sizeOnDisk,
          });
        }
      }

      if (mempoolRes.status === 'fulfilled' && mempoolRes.value.ok) {
        const mempool = await mempoolRes.value.json();
        if (mempool.count != null) {
          this.emit('mempool', { count: mempool.count });
        }
      }

      if (peersRes.status === 'fulfilled' && peersRes.value.ok) {
        const peers = await peersRes.value.json();
        if (peers.peers?.length) {
          // 피어 위치 → nodeData에 전달하기 위해 별도 이벤트
          this.emit('peers', { peers: peers.peers });
        }
      }

      if (mempoolInfoRes.status === 'fulfilled' && mempoolInfoRes.value.ok) {
        const info = await mempoolInfoRes.value.json();
        if (!info.error) this.emit('mempoolInfo', info);
      }

      if (chaintipsRes.status === 'fulfilled' && chaintipsRes.value.ok) {
        const tips = await chaintipsRes.value.json();
        if (Array.isArray(tips)) this.emit('chaintips', tips);
      }

      if (feesRes.status === 'fulfilled' && feesRes.value.ok) {
        const fees = await feesRes.value.json();
        if (!fees.error) {
          // MempoolAdapter와 동일한 fees 이벤트 형식으로 emit
          this.emit('fees', {
            fastestFee: fees.fastest?.feerate,
            halfHourFee: fees.half?.feerate,
            hourFee: fees.hour?.feerate,
          });
        }
      }
    } catch (_) {
      // REST 폴링 실패 무시 (WebSocket으로 계속 수신)
    }

    if (!this._destroyed) {
      this._pollTimer = setTimeout(() => this._poll(), 30000);
    }
  }

  destroy() {
    this._destroyed = true;
    if (this._connectTimer) clearTimeout(this._connectTimer);
    if (this._pollTimer) clearTimeout(this._pollTimer);
    if (this._slowPollTimer) clearTimeout(this._slowPollTimer);
    if (this._medPollTimer) clearTimeout(this._medPollTimer);
    if (this._ws) this._ws.close();
    this.clear();
  }
}
