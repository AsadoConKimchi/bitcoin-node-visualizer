'use strict';

const config = require('./config');

// Node 20 내장 fetch 사용 (node-fetch 불필요)
const RPC_URL = `http://${config.rpc.host}:${config.rpc.port}/`;
const AUTH = Buffer.from(`${config.rpc.user}:${config.rpc.pass}`).toString('base64');

let _reqId = 0;

/**
 * Bitcoin Core JSON-RPC 호출
 * @param {string} method
 * @param {Array} params
 * @returns {Promise<any>}
 */
async function rpcCall(method, params = []) {
  const id = ++_reqId;
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${AUTH}`,
    },
    body: JSON.stringify({ jsonrpc: '1.1', id, method, params }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}: ${method}`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC error [${json.error.code}]: ${json.error.message}`);
  }
  return json.result;
}

// ── 공개 RPC 래퍼 ────────────────────────────────────────────────────────────

/** 현재 블록 높이 반환 */
async function getBlockCount() {
  return rpcCall('getblockcount');
}

/** 블록 해시 반환 */
async function getBlockHash(height) {
  return rpcCall('getblockhash', [height]);
}

/**
 * 블록 데이터 반환
 * verbosity: 0=hex, 1=요약JSON, 2=TX포함JSON
 */
async function getBlock(hashOrHeight, verbosity = 2) {
  const hash =
    typeof hashOrHeight === 'number'
      ? await getBlockHash(hashOrHeight)
      : hashOrHeight;
  return rpcCall('getblock', [hash, verbosity]);
}

/** mempool TX id 목록 반환 */
async function getRawMempool() {
  return rpcCall('getrawmempool', [false]);
}

/** mempool TX 상세 정보 반환 */
async function getRawMempoolVerbose() {
  return rpcCall('getrawmempool', [true]);
}

/** TX 원시 hex 반환 */
async function getRawTransaction(txid, verbose = false) {
  return rpcCall('getrawtransaction', [txid, verbose ? 1 : 0]);
}

/** 네트워크 정보 반환 (연결된 피어 수 포함) */
async function getNetworkInfo() {
  return rpcCall('getnetworkinfo');
}

/** 피어 정보 목록 반환 */
async function getPeerInfo() {
  return rpcCall('getpeerinfo');
}

/** blockchain 정보 반환 */
async function getBlockchainInfo() {
  return rpcCall('getblockchaininfo');
}

module.exports = {
  getBlockCount,
  getBlockHash,
  getBlock,
  getRawMempool,
  getRawMempoolVerbose,
  getRawTransaction,
  getNetworkInfo,
  getPeerInfo,
  getBlockchainInfo,
};
