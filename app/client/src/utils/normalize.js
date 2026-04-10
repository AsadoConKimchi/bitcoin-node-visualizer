// RPC 응답 정규화 함수
// Bitcoin Core RPC 형식 → 앱 내부 형식(mempool.space API 호환)으로 변환

// Bitcoin Core RPC script type → mempool.space 형식 변환
function mapScriptType(rpcType) {
  if (!rpcType) return null;
  const MAP = {
    'witness_v1_taproot': 'v1_p2tr',
    'witness_v0_keyhash': 'v0_p2wpkh',
    'witness_v0_scripthash': 'v0_p2wsh',
    'pubkeyhash': 'p2pkh',
    'scripthash': 'p2sh',
    'nulldata': 'op_return',
    'multisig': 'multisig',
    'nonstandard': 'nonstandard',
  };
  return MAP[rpcType] || rpcType;
}

// RPC 응답 → 정규화 (verbosity=2: vin[].prevout 포함)
export function normalizeRpcTx(rpc) {
  const fee = rpc.fee != null ? Math.round(rpc.fee * 1e8) : null;

  const vins = (rpc.vin || []).map(v => {
    const isCoinbase = !!v.coinbase;
    let prevout = null;

    if (v.prevout) {
      prevout = {
        value: v.prevout.value != null ? Math.round(v.prevout.value * 1e8) : null,
        scriptpubkey_address: v.prevout.scriptPubKey?.address ?? null,
        scriptpubkey_type: mapScriptType(v.prevout.scriptPubKey?.type),
      };
    }

    return {
      ...v,
      isCoinbase,
      sequence: v.sequence,
      witness: v.txinwitness || v.witness || [],
      prevout,
    };
  });

  const vouts = (rpc.vout || []).map(v => ({
    value: v.value != null ? Math.round(v.value * 1e8) : null,
    scriptpubkey_address: v.scriptPubKey?.address ?? null,
    scriptpubkey_type: mapScriptType(v.scriptPubKey?.type),
  }));

  // fee 없을 때 prevout에서 계산 시도
  let computedFee = fee;
  if (computedFee == null) {
    const hasAllPrevout = vins.every(v => v.isCoinbase || v.prevout?.value != null);
    const hasCoinbase = vins.some(v => v.isCoinbase);
    if (hasAllPrevout && !hasCoinbase) {
      const totalIn = vins.reduce((s, v) => s + (v.prevout?.value || 0), 0);
      const totalOut = vouts.reduce((s, v) => s + (v.value || 0), 0);
      computedFee = totalIn - totalOut;
    }
  }

  return {
    txid: rpc.txid,
    size: rpc.size,
    weight: rpc.weight,
    fee: computedFee,
    version: rpc.version,
    locktime: rpc.locktime,
    vin: vins,
    vout: vouts,
    status: {
      confirmed: rpc.blockhash != null,
      block_height: rpc.blockheight ?? null,
      block_time: rpc.blocktime ?? null,
      confirmations: rpc.confirmations ?? null,
    },
  };
}

// RPC 응답(getblock verbosity=1)을 mempool.space 형식으로 정규화
export function normalizeRpcBlock(rpc) {
  return {
    id: rpc.hash,
    height: rpc.height,
    timestamp: rpc.time,
    tx_count: rpc.nTx,
    size: rpc.size,
    weight: rpc.weight,
    difficulty: rpc.difficulty,
    nonce: rpc.nonce,
    bits: rpc.bits,
    merkle_root: rpc.merkleroot,
    previousblockhash: rpc.previousblockhash,
    version: rpc.version,
    extras: null,
    _txids: rpc.tx || [],
    txTypeStats: rpc.txTypeStats || null,
    blockStats: rpc.blockStats || null,
    txSummary: rpc.txSummary || null,
  };
}
