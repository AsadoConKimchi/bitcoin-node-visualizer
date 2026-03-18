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
let _lastMempoolSize = -1;

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

    // mempool 크기 변화 감지 (개별 TX는 추적 불가, 크기만)
    const mempool = await rpc.getRawMempool();
    const mempoolSize = mempool.length;
    if (mempoolSize !== _lastMempoolSize) {
      broadcaster.broadcast('mempool', {
        count: mempoolSize,
        delta: mempoolSize - (_lastMempoolSize === -1 ? mempoolSize : _lastMempoolSize),
      });
      _lastMempoolSize = mempoolSize;
    }

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
