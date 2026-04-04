'use strict';

// 프로덕션(Docker)에서는 dotenv 스킵 — 환경변수는 Docker/Umbrel이 주입
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
}

const config = {
  // 서버
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Bitcoin Core RPC
  rpc: {
    host: process.env.BITCOIN_RPC_HOST || '127.0.0.1',
    port: parseInt(process.env.BITCOIN_RPC_PORT || '8332', 10),
    user: process.env.BITCOIN_RPC_USER || '',
    pass: process.env.BITCOIN_RPC_PASS || '',
    // RPC 폴링 간격 (ms)
    pollIntervalMs: parseInt(process.env.RPC_POLL_INTERVAL_MS || '5000', 10),
  },

  // ZMQ
  zmq: {
    host: process.env.BITCOIN_ZMQ_HOST || '127.0.0.1',
    rawblockPort: parseInt(process.env.BITCOIN_ZMQ_RAWBLOCK_PORT || '28332', 10),
    rawtxPort: parseInt(process.env.BITCOIN_ZMQ_RAWTX_PORT || '28333', 10),
    // ZMQ 연결 대기 시간 초과 후 폴링으로 전환 (ms)
    connectTimeoutMs: parseInt(process.env.ZMQ_CONNECT_TIMEOUT_MS || '5000', 10),
  },
};

// RPC 설정 진단 로깅
const maskedPass = config.rpc.pass
  ? `${config.rpc.pass.slice(0, 4)}****` : '(비어있음)';
console.log(`[config] RPC → ${config.rpc.user}@${config.rpc.host}:${config.rpc.port} (pass: ${maskedPass})`);
console.log(`[config] ZMQ → ${config.zmq.host}:${config.zmq.rawblockPort}/${config.zmq.rawtxPort}`);

if (!config.rpc.user || !config.rpc.pass) {
  console.error('[config] ⚠ BITCOIN_RPC_USER / BITCOIN_RPC_PASS 미설정 — RPC 호출 실패 예상');
}

module.exports = config;
