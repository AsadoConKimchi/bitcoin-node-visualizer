import React, { useEffect, useState } from 'react';

const REST_BASE = 'https://mempool.space/api';

function Row({ label, value, mono, highlight }) {
  return (
    <div className="flex justify-between py-1 border-b border-dark-surface gap-3">
      <span className="text-muted shrink-0 text-sm">{label}</span>
      <span className={`text-right text-sm ${highlight ? 'text-tx-blue' : 'text-text-primary'}
                       ${mono ? 'break-all text-xs' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

// 스크립트 타입 한글 표시
function scriptTypeLabel(type) {
  const labels = {
    'v0_p2wpkh': 'P2WPKH (SegWit)',
    'v0_p2wsh': 'P2WSH (SegWit)',
    'v1_p2tr': 'P2TR (Taproot)',
    'p2pkh': 'P2PKH (Legacy)',
    'p2sh': 'P2SH',
    'op_return': 'OP_RETURN',
    'multisig': 'Multisig',
  };
  return labels[type] || type || '?';
}

// RPC 응답을 mempool.space 형식으로 정규화
function normalizeRpcTx(rpc) {
  return {
    txid: rpc.txid,
    size: rpc.size,
    weight: rpc.weight,
    fee: rpc.fee != null ? Math.round(rpc.fee * 1e8) : null,
    vin: (rpc.vin || []).map(v => ({
      ...v,
      sequence: v.sequence,
      prevout: v.vout != null ? {
        value: v.prevout?.value != null ? Math.round(v.prevout.value * 1e8) : null,
        scriptpubkey_address: v.prevout?.scriptPubKey?.address ?? null,
        scriptpubkey_type: v.prevout?.scriptPubKey?.type ?? null,
      } : null,
    })),
    vout: (rpc.vout || []).map(v => ({
      value: v.value != null ? Math.round(v.value * 1e8) : null,
      scriptpubkey_address: v.scriptPubKey?.address ?? null,
      scriptpubkey_type: v.scriptPubKey?.type ?? null,
    })),
    status: {
      confirmed: rpc.blockhash != null,
      block_height: rpc.blockheight ?? null,
    },
  };
}

export default function TxDetailPanel({ tx, onClose, sourceType }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllInputs, setShowAllInputs] = useState(false);
  const [showAllOutputs, setShowAllOutputs] = useState(false);

  useEffect(() => {
    if (!tx?.txid) return;
    setLoading(true);
    setError(null);

    const url = sourceType === 'server'
      ? `/api/tx/${tx.txid}`
      : `${REST_BASE}/tx/${tx.txid}`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setDetail(sourceType === 'server' ? normalizeRpcTx(data) : data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [tx?.txid, sourceType]);

  const short = tx?.txid ? tx.txid.slice(0, 8) + '…' + tx.txid.slice(-4) : '?';
  const localData = tx?.data || {};

  // RBF 감지
  const isRbf = detail?.vin?.some(v => v.sequence < 0xfffffffe);
  // 확인 수
  const confirmations = detail?.status?.confirmed ? detail.status.block_height : null;

  const inputLimit = showAllInputs ? Infinity : 5;
  const outputLimit = showAllOutputs ? Infinity : 5;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[19]" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[400px] max-h-[70vh] overflow-y-auto bg-panel-bg-solid
                      border border-tx-blue rounded-lg px-5 py-4
                      font-mono text-sm text-text-primary backdrop-blur-md z-20
                      shadow-[0_0_40px_rgba(147,197,253,0.2)]
                      max-sm:w-[calc(100vw-24px)] max-sm:max-h-[80vh]">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-tx-blue/25">
          <div>
            <div className="text-tx-blue font-bold text-base">TX {short}</div>
            <div className="flex gap-2 mt-1">
              {isRbf && (
                <span className="text-[9px] bg-orange-500/15 border border-orange-500/30 text-orange-400
                               px-1.5 py-0.5 rounded">RBF</span>
              )}
              {confirmations != null && (
                <span className="text-[9px] bg-green-500/15 border border-green-500/30 text-green-400
                               px-1.5 py-0.5 rounded">
                  {detail.status.confirmed ? `확인됨 (블록 #${confirmations.toLocaleString()})` : '미확인'}
                </span>
              )}
              {detail && !detail.status?.confirmed && (
                <span className="text-[9px] bg-yellow-500/15 border border-yellow-500/30 text-yellow-400
                               px-1.5 py-0.5 rounded">미확인 (멤풀)</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border border-muted-dim rounded text-muted
                      cursor-pointer px-2 py-0.5 font-mono text-sm hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {loading && !detail && (
          <div className="text-text-dim text-center py-4">로드 중…</div>
        )}

        {error && !detail && (
          <div className="text-error text-center py-2 text-xs">로드 실패: {error}</div>
        )}

        <Row label="TXID" value={tx?.txid} mono />
        <Row label="크기" value={
          localData.size != null || localData.weight != null
            ? `${localData.size ?? '?'} B · ${localData.weight ?? '?'} WU`
            : detail ? `${detail.size ?? '?'} B · ${detail.weight ?? '?'} WU` : null
        } />
        <Row label="수수료" value={
          detail?.fee != null
            ? `${detail.fee} sats (~${Math.round(detail.fee / (detail.weight / 4))} sat/vB)`
            : tx?.feeRate ? `~${tx.feeRate} sat/vB` : null
        } />

        {detail && (
          <>
            {/* INPUTS */}
            <div className="mt-2.5">
              <div className="text-tx-blue text-xs font-bold mb-1">
                ▸ INPUTS ({detail.vin?.length ?? '?'})
              </div>
              {detail.vin?.slice(0, inputLimit).map((inp, i) => (
                <div key={i} className="text-xs text-text-secondary py-0.5 border-b border-dark-surface">
                  <div className="flex items-center gap-1">
                    <span className="text-muted">{i}: </span>
                    {inp.prevout?.scriptpubkey_address
                      ? <span className="truncate max-w-[180px]">{inp.prevout.scriptpubkey_address}</span>
                      : <span className="text-text-dim">coinbase</span>
                    }
                    {inp.prevout?.value != null && (
                      <span className="ml-auto text-btc-orange shrink-0">
                        {(inp.prevout.value / 1e8).toFixed(8)} BTC
                      </span>
                    )}
                  </div>
                  {inp.prevout?.scriptpubkey_type && (
                    <div className="text-[9px] text-muted ml-3">
                      {scriptTypeLabel(inp.prevout.scriptpubkey_type)}
                    </div>
                  )}
                </div>
              ))}
              {detail.vin?.length > 5 && (
                <button
                  onClick={() => setShowAllInputs(!showAllInputs)}
                  className="text-tx-blue text-[10px] cursor-pointer bg-transparent border-none
                            hover:underline py-0.5"
                >
                  {showAllInputs ? '접기 ▴' : `… ${detail.vin.length - 5}개 더 ▾`}
                </button>
              )}
            </div>

            {/* OUTPUTS */}
            <div className="mt-2">
              <div className="text-tx-blue text-xs font-bold mb-1">
                ▸ OUTPUTS ({detail.vout?.length ?? '?'})
              </div>
              {detail.vout?.slice(0, outputLimit).map((out, i) => (
                <div key={i} className="text-xs text-text-secondary py-0.5 border-b border-dark-surface">
                  <div className="flex items-center gap-1">
                    <span className="text-muted">{i}: </span>
                    {out.scriptpubkey_address
                      ? <span className="truncate max-w-[180px]">{out.scriptpubkey_address}</span>
                      : <span className="text-text-dim">OP_RETURN</span>
                    }
                    {out.value != null && (
                      <span className="ml-auto text-success shrink-0">
                        {(out.value / 1e8).toFixed(8)} BTC
                      </span>
                    )}
                  </div>
                  {out.scriptpubkey_type && (
                    <div className="text-[9px] text-muted ml-3">
                      {scriptTypeLabel(out.scriptpubkey_type)}
                    </div>
                  )}
                </div>
              ))}
              {detail.vout?.length > 5 && (
                <button
                  onClick={() => setShowAllOutputs(!showAllOutputs)}
                  className="text-tx-blue text-[10px] cursor-pointer bg-transparent border-none
                            hover:underline py-0.5"
                >
                  {showAllOutputs ? '접기 ▴' : `… ${detail.vout.length - 5}개 더 ▾`}
                </button>
              )}
            </div>
          </>
        )}

        {!detail && !loading && (
          <>
            <Row label="Inputs" value={localData.vin ?? '?'} />
            <Row label="Outputs" value={localData.vout ?? '?'} />
            {localData.totalOut != null && (
              <Row label="Total Out" value={`${(localData.totalOut / 1e8).toFixed(8)} BTC`} highlight />
            )}
          </>
        )}

        {sourceType !== 'server' && (
          <div className="mt-3 text-center">
            <a
              href={`https://mempool.space/tx/${tx?.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-tx-blue text-xs no-underline border border-tx-blue/25
                        px-3 py-1 rounded hover:bg-tx-blue/10"
            >
              mempool.space에서 보기 ↗
            </a>
          </div>
        )}
      </div>
    </>
  );
}
