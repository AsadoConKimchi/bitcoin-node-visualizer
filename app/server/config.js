'use strict';

// .env.local → .env 순서로 로드 (Vite 컨벤션 맞춤)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

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

// RPC 자격증명 미설정 경고
if (!config.rpc.user || !config.rpc.pass) {
  console.warn('[config] ⚠ BITCOIN_RPC_USER / BITCOIN_RPC_PASS 환경변수가 설정되지 않았습니다.');
}

module.exports = config;
