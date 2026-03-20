import React, { useEffect, useState } from 'react';
import TxSankeyDiagram from './TxSankeyDiagram.jsx';

const REST_BASE = 'https://mempool.space/api';

// 스크립트 타입 표시
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

// RPC 응답 → 정규화 (verbosity=2: vin[].prevout 포함)
function normalizeRpcTx(rpc) {
  // fee: BTC float → sats (서버 보강 또는 verbosity=2 응답)
  const fee = rpc.fee != null ? Math.round(rpc.fee * 1e8) : null;

  const vins = (rpc.vin || []).map(v => {
    const isCoinbase = !!v.coinbase;
    let prevout = null;

    if (v.prevout) {
      prevout = {
        value: v.prevout.value != null ? Math.round(v.prevout.value * 1e8) : null,
        scriptpubkey_address: v.prevout.scriptPubKey?.address ?? null,
        scriptpubkey_type: v.prevout.scriptPubKey?.type ?? null,
      };
    }

    return {
      ...v,
      isCoinbase,
      sequence: v.sequence,
      prevout,
    };
  });

  const vouts = (rpc.vout || []).map(v => ({
    value: v.value != null ? Math.round(v.value * 1e8) : null,
    scriptpubkey_address: v.scriptPubKey?.address ?? null,
    scriptpubkey_type: v.scriptPubKey?.type ?? null,
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
    vin: vins,
    vout: vouts,
    status: {
      confirmed: rpc.blockhash != null,
      block_height: rpc.blockheight ?? null,
    },
  };
}

// 카드 컴포넌트
function InfoCard({ label, value, highlight }) {
  return (
    <div className="flex-1 bg-dark-surface/60 border border-white/6 rounded-lg px-3 py-2 text-center">
      <div className="text-[11px] text-muted mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-bold ${highlight || 'text-text-primary'}`}>{value ?? '—'}</div>
    </div>
  );
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

  const localData = tx?.data || {};
  const isRbf = detail?.vin?.some(v => v.sequence < 0xfffffffe);

  // 수수료/크기 계산
  const fee = detail?.fee;
  const weight = detail?.weight;
  const vsize = weight ? (weight / 4).toFixed(2) : null;
  const feeRate = fee != null && vsize ? (fee / parseFloat(vsize)).toFixed(2) : null;

  // 총 출력 가치
  const totalOut = detail?.vout?.reduce((s, o) => s + (o.value || 0), 0);

  // Sankey input/output 데이터
  const sankeyInputs = detail?.vin?.map(v => ({
    address: v.isCoinbase ? 'coinbase' : (v.prevout?.scriptpubkey_address || (v.txid ? `${v.txid.slice(0, 8)}…:${v.vout}` : null)),
    value: v.prevout?.value || 0,
    type: v.prevout?.scriptpubkey_type,
  })) || [];

  const sankeyOutputs = detail?.vout?.map(v => ({
    address: v.scriptpubkey_address,
    value: v.value || 0,
    type: v.scriptpubkey_type,
  })) || [];

  const inputLimit = showAllInputs ? Infinity : 5;
  const outputLimit = showAllOutputs ? Infinity : 5;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[19]" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[600px] max-h-[80vh] overflow-y-auto bg-panel-bg-solid
                      border border-white/10 rounded-xl px-5 py-4
                      font-mono text-sm text-text-primary backdrop-blur-md z-20
                      max-sm:w-[calc(100vw-24px)] max-sm:max-h-[85vh]"
           style={{ boxShadow: 'var(--shadow-modal)' }}>

        {/* 1. 헤더 */}
        <div className="flex justify-between items-start mb-3 pb-2 border-b border-white/10">
          <div>
            <div className="text-tx-blue font-bold text-base mb-1">Transaction</div>
            <div className="text-[11px] text-text-dim font-mono break-all">{tx?.txid}</div>
            <div className="flex gap-2 mt-1.5">
              {isRbf && (
                <span className="text-[11px] bg-orange-500/15 border border-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded">RBF</span>
              )}
              {detail?.status?.confirmed ? (
                <span className="text-[11px] bg-green-500/15 border border-green-500/30 text-green-400 px-1.5 py-0.5 rounded">
                  확인됨 (블록 #{detail.status.block_height?.toLocaleString()})
                </span>
              ) : detail ? (
                <span className="text-[11px] bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 px-1.5 py-0.5 rounded">
                  미확인 (멤풀)
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border border-white/10 rounded text-muted
                      cursor-pointer px-2 py-0.5 text-sm hover:text-text-primary hover:bg-white/5 shrink-0"
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

        {detail && (
          <>
            {/* 2. 수수료 공식 카드 */}
            <div className="flex gap-2 mb-3">
              <InfoCard label="Fee" value={fee != null ? `${fee.toLocaleString()} sats` : null} highlight="text-btc-orange" />
              <InfoCard label="÷ Size" value={vsize ? `${vsize} vB` : null} />
              <InfoCard label="= Fee Rate" value={feeRate ? `${feeRate} sat/vB` : null} highlight="text-btc-orange" />
            </div>

            {/* 3. 총 가치 카드 */}
            {totalOut != null && (
              <div className="bg-dark-surface/60 border border-white/6 rounded-lg px-4 py-2.5 mb-4 text-center">
                <div className="text-[11px] text-muted mb-0.5">Total Output Value</div>
                <div className="text-lg font-mono font-bold text-btc-orange">
                  ₿ {(totalOut / 1e8).toFixed(8)}
                </div>
              </div>
            )}

            {/* 4. Sankey 플로우 다이어그램 */}
            {(sankeyInputs.length > 0 || sankeyOutputs.length > 0) && (
              <div className="mb-4 border border-white/6 rounded-lg overflow-hidden bg-dark-surface/30 p-2">
                <div className="text-[11px] text-muted font-bold tracking-wide mb-1 px-1">FLOW</div>
                <TxSankeyDiagram inputs={sankeyInputs} outputs={sankeyOutputs} fee={fee || 0} />
              </div>
            )}

            {/* 5. Inputs 상세 */}
            <div className="mt-2">
              <div className="text-tx-blue text-xs font-bold mb-1">
                ▸ INPUTS ({detail.vin?.length ?? '?'})
              </div>
              {detail.vin?.slice(0, inputLimit).map((inp, i) => (
                <div key={i} className="text-xs text-text-secondary py-0.5 border-b border-dark-surface">
                  <div className="flex items-center gap-1">
                    <span className="text-muted">{i}: </span>
                    {inp.isCoinbase
                      ? <span className="text-text-dim">coinbase</span>
                      : inp.prevout?.scriptpubkey_address
                        ? <span className="truncate max-w-[260px]">{inp.prevout.scriptpubkey_address}</span>
                        : <span className="text-text-dim">
                            {inp.txid ? `${inp.txid.slice(0, 12)}…:${inp.vout}` : '(unknown)'}
                          </span>
                    }
                    {inp.prevout?.value != null && inp.prevout.value > 0 && (
                      <span className="ml-auto text-btc-orange shrink-0">
                        {(inp.prevout.value / 1e8).toFixed(8)} BTC
                      </span>
                    )}
                  </div>
                  {inp.prevout?.scriptpubkey_type && (
                    <div className="text-[11px] text-muted ml-3">
                      {scriptTypeLabel(inp.prevout.scriptpubkey_type)}
                    </div>
                  )}
                </div>
              ))}
              {detail.vin?.length > 5 && (
                <button
                  onClick={() => setShowAllInputs(!showAllInputs)}
                  className="text-tx-blue text-[11px] cursor-pointer bg-transparent border-none hover:underline py-0.5"
                >
                  {showAllInputs ? '접기 ▴' : `… ${detail.vin.length - 5}개 더 ▾`}
                </button>
              )}
            </div>

            {/* 6. Outputs 상세 */}
            <div className="mt-2">
              <div className="text-tx-blue text-xs font-bold mb-1">
                ▸ OUTPUTS ({detail.vout?.length ?? '?'})
              </div>
              {detail.vout?.slice(0, outputLimit).map((out, i) => (
                <div key={i} className="text-xs text-text-secondary py-0.5 border-b border-dark-surface">
                  <div className="flex items-center gap-1">
                    <span className="text-muted">{i}: </span>
                    {out.scriptpubkey_address
                      ? <span className="truncate max-w-[260px]">{out.scriptpubkey_address}</span>
                      : <span className="text-text-dim">OP_RETURN</span>
                    }
                    {out.value != null && (
                      <span className="ml-auto text-success shrink-0">
                        {(out.value / 1e8).toFixed(8)} BTC
                      </span>
                    )}
                  </div>
                  {out.scriptpubkey_type && (
                    <div className="text-[11px] text-muted ml-3">
                      {scriptTypeLabel(out.scriptpubkey_type)}
                    </div>
                  )}
                </div>
              ))}
              {detail.vout?.length > 5 && (
                <button
                  onClick={() => setShowAllOutputs(!showAllOutputs)}
                  className="text-tx-blue text-[11px] cursor-pointer bg-transparent border-none hover:underline py-0.5"
                >
                  {showAllOutputs ? '접기 ▴' : `… ${detail.vout.length - 5}개 더 ▾`}
                </button>
              )}
            </div>
          </>
        )}

        {!detail && !loading && (
          <div className="space-y-1">
            <div className="flex justify-between py-1 border-b border-dark-surface">
              <span className="text-muted text-sm">Inputs</span>
              <span className="text-sm">{localData.vin ?? '?'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dark-surface">
              <span className="text-muted text-sm">Outputs</span>
              <span className="text-sm">{localData.vout ?? '?'}</span>
            </div>
          </div>
        )}

        {sourceType !== 'server' && (
          <div className="mt-3 text-center">
            <a
              href={`https://mempool.space/tx/${tx?.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary text-xs no-underline border border-white/10
                        px-3 py-1 rounded hover:bg-white/5 hover:text-text-primary"
            >
              mempool.space에서 보기 ↗
            </a>
          </div>
        )}
      </div>
    </>
  );
}
