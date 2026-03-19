'use strict';

const config = require('./config');
const rpc = require('./rpc');
const broadcaster = require('./broadcaster');
const validator = require('./validator');

// ZMQ 연결 상태
// 'zmq'    → ZMQ 실시간 모드
// 'rpc'    → RPC 폴링 폴백
// 'error'  → 연결 없음
let connectionMode = 'error';

/** 현재 연결 모드 반환 */
function getMode() {
  return connectionMode;
}

// ── RPC 폴링 폴백 ─────────────────────────────────────────────────────────────

let _pollTimer = null;
let _lastBlockHeight = -1;
let _lastMempoolTxids = new Set();

// RPC 폴링 시 상세 조회 TX 수 제한
const TX_DETAIL_LIMIT = 5;
// 간단 emit TX 추가 제한
const TX_SIMPLE_LIMIT = 10;

function setMode(mode) {
  if (connectionMode !== mode) {
    connectionMode = mode;
    broadcaster.broadcast('status', { mode });
    console.log(`[ZMQ] 연결 모드: ${mode}`);
  }
}

async function pollOnce() {
  try {
    // 블록 높이 변화 감지
    const height = await rpc.getBlockCount();
    if (height !== _lastBlockHeight) {
      if (_lastBlockHeight !== -1) {
        // 새 블록 감지
        try {
          const block = await rpc.getBlock(height, 2);
          await validator.processBlock(block, 'rpc');
        } catch (err) {
          console.error('[ZMQ/poll] 블록 처리 오류:', err.message);
        }
      }
      _lastBlockHeight = height;
    }

    // mempool verbose 조회 → diff로 새 TX 감지
    const mempoolVerbose = await rpc.getRawMempoolVerbose();
    const currentTxids = Object.keys(mempoolVerbose);
    const currentSet = new Set(currentTxids);
    const newTxids = currentTxids.filter(txid => !_lastMempoolTxids.has(txid));

    // 상세 TX emit (getrawtransaction → processRawTx)
    for (const txid of newTxids.slice(0, TX_DETAIL_LIMIT)) {
      try {
        const rawHex = await rpc.getRawTransaction(txid);
        await validator.processRawTx(Buffer.from(rawHex, 'hex'));
      } catch {
        // 이미 블록에 포함되었거나 mempool에서 제거된 경우 무시
      }
    }

    // 나머지 새 TX는 verbose 데이터로 간단 emit
    for (const txid of newTxids.slice(TX_DETAIL_LIMIT, TX_DETAIL_LIMIT + TX_SIMPLE_LIMIT)) {
      const info = mempoolVerbose[txid];
      if (!info) continue;
      const fee = info.fees?.base ?? info.fee ?? 0;
      broadcaster.broadcast('tx', {
        txid,
        size: info.vsize ?? 0,
        weight: info.weight ?? 0,
        feeRate: info.vsize ? Math.round(fee * 1e8 / info.vsize) : 0,
      });
    }

    const delta = newTxids.length;
    broadcaster.broadcast('mempool', { count: currentTxids.length, delta });
    _lastMempoolTxids = currentSet;

    setMode('rpc');
  } catch (err) {
    console.warn('[ZMQ/poll] RPC 폴링 실패:', err.message);
    setMode('error');
  }
}

function startPolling() {
  if (_pollTimer) return;
  console.log('[ZMQ] RPC 폴링 시작 (간격:', config.rpc.pollIntervalMs, 'ms)');
  // 즉시 1회 실행
  pollOnce();
  _pollTimer = setInterval(pollOnce, config.rpc.pollIntervalMs);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

// ── ZMQ 구독 ─────────────────────────────────────────────────────────────────

async function startZmq() {
  let zmqModule;
  try {
    zmqModule = require('zeromq');
  } catch {
    console.warn('[ZMQ] zeromq 모듈 없음 → RPC 폴링 전용 모드');
    startPolling();
    return;
  }

  const { Subscriber } = zmqModule;

  // rawblock 구독
  const blockSock = new Subscriber();
  // rawtx 구독
  const txSock = new Subscriber();

  const blockAddr = `tcp://${config.zmq.host}:${config.zmq.rawblockPort}`;
  const txAddr = `tcp://${config.zmq.host}:${config.zmq.rawtxPort}`;

  // 연결 타임아웃 처리
  const connectTimeout = setTimeout(() => {
    console.warn('[ZMQ] 연결 타임아웃 → RPC 폴링 폴백');
    try { blockSock.close(); } catch {}
    try { txSock.close(); } catch {}
    startPolling();
  }, config.zmq.connectTimeoutMs);

  try {
    blockSock.subscribe('rawblock');
    txSock.subscribe('rawtx');

    blockSock.connect(blockAddr);
    txSock.connect(txAddr);

    console.log('[ZMQ] 블록 구독:', blockAddr);
    console.log('[ZMQ] TX 구독:', txAddr);

    // 블록 수신 루프
    (async () => {
      try {
        for await (const [topic, msg] of blockSock) {
          clearTimeout(connectTimeout);
          stopPolling();
          setMode('zmq');

          try {
            await validator.processRawBlock(Buffer.from(msg));
          } catch (err) {
            console.error('[ZMQ] 블록 처리 오류:', err.message);
          }
        }
      } catch (err) {
        if (!err.message.includes('Socket closed')) {
          console.error('[ZMQ] 블록 소켓 오류:', err.message);
          startPolling();
        }
      }
    })();

    // TX 수신 루프
    (async () => {
      try {
        for await (const [topic, msg] of txSock) {
          clearTimeout(connectTimeout);
          stopPolling();
          setMode('zmq');

          try {
            await validator.processRawTx(Buffer.from(msg));
          } catch (err) {
            console.error('[ZMQ] TX 처리 오류:', err.message);
          }
        }
      } catch (err) {
        if (!err.message.includes('Socket closed')) {
          console.error('[ZMQ] TX 소켓 오류:', err.message);
        }
      }
    })();

  } catch (err) {
    clearTimeout(connectTimeout);
    console.warn('[ZMQ] 연결 실패:', err.message, '→ RPC 폴링 폴백');
    try { blockSock.close(); } catch {}
    try { txSock.close(); } catch {}
    startPolling();
  }
}

module.exports = { startZmq, getMode };
