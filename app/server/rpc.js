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
  let res;
  try {
    res = await fetch(RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${AUTH}`,
    },
    body: JSON.stringify({ jsonrpc: '1.1', id, method, params }),
    signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error(`RPC 연결 거부 — ${RPC_URL} 호스트/포트 확인 필요: ${method}`);
    }
    throw new Error(`RPC 네트워크 오류 — ${err.message}: ${method}`);
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(`RPC 인증 실패 (401) — BITCOIN_RPC_USER/PASS 환경변수 확인 필요: ${method}`);
    }
    if (res.status === 403) {
      throw new Error(`RPC 접근 거부 (403) — rpcallowip 설정 확인 필요: ${method}`);
    }
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

/** 멤풀 정책/상태 반환 (최소fee, 최대크기, 현재사용량 등) */
async function getMempoolInfo() {
  return rpcCall('getmempoolinfo');
}

/** 멤풀 엔트리 조회 (수수료, depends, bip125-replaceable) */
async function getMempoolEntry(txid) {
  return rpcCall('getmempoolentry', [txid]);
}

/** verbose 모드 TX 조회 (verbosity=2: vin[].prevout 포함) */
async function getRawTransactionVerbose(txid) {
  return rpcCall('getrawtransaction', [txid, 2]);
}

/** 체인 분기 기록 반환 (stale/orphan blocks 포함) */
async function getChainTips() {
  return rpcCall('getchaintips');
}

/** 수수료 추정 반환 (목표 블록 수 기준) */
async function estimateSmartFee(blocks = 6) {
  return rpcCall('estimatesmartfee', [blocks]);
}

/** 블록 헤더 반환 (getblockheader) */
async function getBlockHeader(hash) {
  return rpcCall('getblockheader', [hash, true]);
}

/** UTXO 세트 통계 반환 (느림 — 60초 타임아웃, 서버에서 캐시 필요) */
async function getTxOutSetInfo() {
  const id = ++_reqId;
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${AUTH}`,
    },
    body: JSON.stringify({ jsonrpc: '1.1', id, method: 'gettxoutsetinfo', params: [] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}: gettxoutsetinfo`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC error [${json.error.code}]: ${json.error.message}`);
  return json.result;
}

module.exports = {
  getBlockCount,
  getBlockHash,
  getBlock,
  getBlockHeader,
  getRawMempool,
  getRawMempoolVerbose,
  getRawTransaction,
  getRawTransactionVerbose,
  getNetworkInfo,
  getPeerInfo,
  getBlockchainInfo,
  getMempoolInfo,
  getMempoolEntry,
  getChainTips,
  estimateSmartFee,
  getTxOutSetInfo,
};
