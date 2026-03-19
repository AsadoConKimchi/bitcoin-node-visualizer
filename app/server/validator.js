'use strict';

const bitcoin = require('bitcoinjs-lib');
const broadcaster = require('./broadcaster');

// ── Merkle 루트 계산 ──────────────────────────────────────────────────────────

/**
 * double-SHA256 해시 (little-endian)
 * @param {Buffer} buf
 * @returns {Buffer}
 */
function dsha256(buf) {
  return bitcoin.crypto.hash256(buf);
}

/**
 * TX id 배열로 Merkle 루트 계산
 * @param {string[]} txids  hex 문자열 배열
 * @returns {string}  hex Merkle 루트
 */
function calcMerkleRoot(txids) {
  if (txids.length === 0) return '0'.repeat(64);

  // txid는 little-endian으로 저장되므로 reverse 필요
  let hashes = txids.map((id) => Buffer.from(id, 'hex').reverse());

  while (hashes.length > 1) {
    const next = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const a = hashes[i];
      const b = hashes[i + 1] || hashes[i]; // 홀수 개면 마지막 복제
      next.push(dsha256(Buffer.concat([a, b])));
    }
    hashes = next;
  }

  // 결과를 다시 little-endian → hex
  return hashes[0].reverse().toString('hex');
}

// ── TX 처리 ───────────────────────────────────────────────────────────────────

/**
 * raw TX 버퍼 처리 (ZMQ rawtx)
 * @param {Buffer} buf
 */
async function processRawTx(buf) {
  try {
    const tx = bitcoin.Transaction.fromBuffer(buf);
    const txid = tx.getId();

    const summary = {
      txid,
      vin: tx.ins.length,
      vout: tx.outs.length,
      size: buf.length,
      weight: tx.weight(),
      // 아웃풋 총합 (satoshi)
      totalOut: tx.outs.reduce((s, o) => s + o.value, 0),
    };

    broadcaster.broadcast('tx', summary);
  } catch (err) {
    // 파싱 실패한 TX는 무시
    console.warn('[validator] TX 파싱 실패:', err.message);
  }
}

/**
 * raw block 버퍼 처리 (ZMQ rawblock)
 * @param {Buffer} buf
 */
async function processRawBlock(buf) {
  try {
    const block = bitcoin.Block.fromBuffer(buf);
    const blockHash = block.getId();
    const txids = block.transactions
      ? block.transactions.map((tx) => tx.getId())
      : [];

    // merkleRoot/prevHash를 in-place reverse 전에 미리 캡처
    const headerMerkleRoot = Buffer.from(block.merkleRoot).reverse().toString('hex');
    const headerPrevHash = Buffer.from(block.prevHash).reverse().toString('hex');

    // Merkle 재검증
    const calcRoot = block.transactions ? calcMerkleRoot(txids) : null;
    const merkleMatch =
      calcRoot === null ||
      calcRoot === headerMerkleRoot;

    // coinbase 보상 계산 (첫 TX의 아웃풋 합)
    const coinbaseValue = block.transactions?.[0]
      ? block.transactions[0].outs.reduce((s, o) => s + o.value, 0)
      : null;
    // 블록 weight 계산 (전체 TX weight 합)
    const blockWeight = block.transactions
      ? block.transactions.reduce((s, tx) => s + tx.weight(), 0)
      : null;

    const summary = {
      hash: blockHash,
      height: null, // rawblock에는 height 없음 — RPC로 조회 가능
      txCount: txids.length,
      size: buf.length,
      time: block.timestamp,
      merkleOk: merkleMatch,
      source: 'zmq',
      version: block.version,
      nBits: block.bits,
      prevHash: headerPrevHash,
      merkleRoot: headerMerkleRoot,
      txidSample: txids.length <= 8 ? txids : [...txids.slice(0, 4), ...txids.slice(-4)],
      coinbaseValue,
      weight: blockWeight,
    };

    // 단계별 이벤트 방출 (500ms 간격)
    broadcaster.broadcast('block:received', summary);
    setTimeout(() => broadcaster.broadcast('block:validated', { ...summary, merkleOk: merkleMatch }), 500);
    setTimeout(() => broadcaster.broadcast('block:propagated', summary), 1000);

    console.log(
      `[validator] 블록 수신 height=? hash=${blockHash.slice(0, 12)}... txs=${txids.length} merkle=${merkleMatch ? 'OK' : 'FAIL'}`
    );
  } catch (err) {
    console.error('[validator] 블록 파싱 실패:', err.message);
  }
}

/**
 * RPC JSON 블록 처리 (RPC 폴링 폴백)
 * @param {object} block  getblock(hash, 2) 결과
 * @param {string} source 'rpc' | 'zmq'
 */
async function processBlock(block, source = 'rpc') {
  try {
    const txids = (block.tx || []).map((tx) =>
      typeof tx === 'string' ? tx : tx.txid
    );

    const calcRoot = calcMerkleRoot(txids);
    const merkleOk = calcRoot === block.merkleroot;

    // coinbase 보상 (RPC verbosity=2 → tx[0].vout 합산)
    const coinbaseTx = block.tx?.[0];
    const coinbaseValue = coinbaseTx?.vout
      ? Math.round(coinbaseTx.vout.reduce((s, o) => s + (o.value || 0), 0) * 1e8)
      : null;

    const summary = {
      hash: block.hash,
      height: block.height,
      txCount: txids.length,
      size: block.size,
      weight: block.weight,
      time: block.time,
      difficulty: block.difficulty,
      merkleOk,
      source,
      version: block.version,
      nBits: block.bits,
      prevHash: block.previousblockhash,
      merkleRoot: block.merkleroot,
      txidSample: txids.length <= 8 ? txids : [...txids.slice(0, 4), ...txids.slice(-4)],
      coinbaseValue,
    };

    // 단계별 이벤트 방출 (500ms 간격)
    broadcaster.broadcast('block:received', summary);
    setTimeout(() => broadcaster.broadcast('block:validated', summary), 500);
    setTimeout(() => broadcaster.broadcast('block:propagated', summary), 1000);

    console.log(
      `[validator] 블록 처리 height=${block.height} hash=${block.hash.slice(0, 12)}... txs=${txids.length} merkle=${merkleOk ? 'OK' : 'FAIL'}`
    );
  } catch (err) {
    console.error('[validator] RPC 블록 처리 오류:', err.message);
  }
}

module.exports = { processRawTx, processRawBlock, processBlock, calcMerkleRoot };
