import React, { useEffect, useState } from 'react';
import TxSankeyDiagram from './TxSankeyDiagram.jsx';
import { formatBtc, CopyButton, detectTxFeatures, scriptTypeLabel, relativeTime } from '../utils/format.jsx';

const REST_BASE = 'https://mempool.space/api';

// RPC 응답 → 정규화 (verbosity=2: vin[].prevout 포함)
function normalizeRpcTx(rpc) {
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
    version: rpc.version,
    locktime: rpc.locktime,
    vin: vins,
    vout: vouts,
    status: {
      confirmed: rpc.blockhash != null,
      block_height: rpc.blockheight ?? null,
      block_time: rpc.blocktime ?? null,
    },
  };
}

// Feature 배지 컴포넌트
function FeatureBadge({ label, color }) {
  return (
    <span
      className="text-[11px] px-1.5 py-0.5 rounded border"
      style={{
        color,
        borderColor: `${color}30`,
        backgroundColor: `${color}15`,
      }}
    >
      {label}
    </span>
  );
}

export default function TxDetailPanel({ tx, onClose, sourceType, onAddressClick }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllInputs, setShowAllInputs] = useState(false);
  const [showAllOutputs, setShowAllOutputs] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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

  // 수수료/크기 계산
  const fee = detail?.fee;
  const weight = detail?.weight;
  const size = detail?.size;
  const vsize = weight ? (weight / 4).toFixed(1) : null;
  const feeRate = fee != null && vsize ? (fee / parseFloat(vsize)).toFixed(2) : null;

  // 총 출력 가치
  const totalOut = detail?.vout?.reduce((s, o) => s + (o.value || 0), 0);

  // Feature 감지
  const features = detail ? detectTxFeatures(detail.vin, detail.vout) : [];

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

  const handleAddrClick = (addr) => {
    if (addr && onAddressClick) onAddressClick(addr);
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[19]" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[720px] max-h-[85vh] overflow-y-auto bg-panel-bg-solid
                      border border-white/10 rounded-xl px-5 py-4
                      font-mono text-sm text-text-primary backdrop-blur-md z-20
                      max-sm:w-[calc(100vw-16px)] max-sm:max-h-[90vh]"
           style={{ boxShadow: 'var(--shadow-modal)' }}>

        {/* 1. Header — TXID + Copy + 확인 배지 */}
        <div className="flex justify-between items-start mb-3 pb-2 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="text-tx-blue font-bold text-base mb-1">Transaction</div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-text-dim font-mono break-all">{tx?.txid}</span>
              {tx?.txid && <CopyButton text={tx.txid} />}
            </div>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {detail?.status?.confirmed ? (
                <span className="text-[11px] bg-green-500/15 border border-green-500/30 text-green-400 px-1.5 py-0.5 rounded">
                  {detail.status.block_height
                    ? `Confirmed (Block #${detail.status.block_height.toLocaleString()})`
                    : 'Confirmed'}
                </span>
              ) : detail ? (
                <span className="text-[11px] bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 px-1.5 py-0.5 rounded">
                  Unconfirmed
                </span>
              ) : null}
              {features.map((f, i) => (
                <FeatureBadge key={i} label={f.label} color={f.color} />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border border-white/10 rounded text-muted
                      cursor-pointer px-2 py-0.5 text-sm hover:text-text-primary hover:bg-white/5 shrink-0 ml-2"
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
            {/* 2. Info Grid — 2열 CSS grid */}
            <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-3">
              {detail.status?.block_time && (
                <div className="bg-dark-surface/60 border border-white/6 rounded-lg px-3 py-2">
                  <div className="text-[11px] text-muted mb-0.5">Timestamp</div>
                  <div className="text-sm font-mono text-text-primary">
                    {relativeTime(detail.status.block_time)}
                  </div>
                  <div className="text-[10px] text-text-dim">
                    {new Date(detail.status.block_time * 1000).toLocaleString('ko-KR')}
                  </div>
                </div>
              )}
              <div className="bg-dark-surface/60 border border-white/6 rounded-lg px-3 py-2">
                <div className="text-[11px] text-muted mb-0.5">Fee</div>
                <div className="text-sm font-mono font-bold text-btc-orange">
                  {fee != null ? `${fee.toLocaleString()} sats` : '—'}
                </div>
              </div>
              <div className="bg-dark-surface/60 border border-white/6 rounded-lg px-3 py-2">
                <div className="text-[11px] text-muted mb-0.5">Fee Rate</div>
                <div className="text-sm font-mono font-bold text-btc-orange">
                  {feeRate ? `${feeRate} sat/vB` : '—'}
                </div>
              </div>
              <div className="bg-dark-surface/60 border border-white/6 rounded-lg px-3 py-2">
                <div className="text-[11px] text-muted mb-0.5">Size</div>
                <div className="text-sm font-mono text-text-primary">
                  {size != null ? `${size.toLocaleString()} B` : '—'}
                </div>
              </div>
              <div className="bg-dark-surface/60 border border-white/6 rounded-lg px-3 py-2">
                <div className="text-[11px] text-muted mb-0.5">Virtual Size</div>
                <div className="text-sm font-mono text-text-primary">
                  {vsize ? `${vsize} vB` : '—'}
                </div>
              </div>
              <div className="bg-dark-surface/60 border border-white/6 rounded-lg px-3 py-2">
                <div className="text-[11px] text-muted mb-0.5">Weight</div>
                <div className="text-sm font-mono text-text-primary">
                  {weight != null ? `${weight.toLocaleString()} WU` : '—'}
                </div>
              </div>
            </div>

            {/* Total Output */}
            {totalOut != null && (
              <div className="bg-dark-surface/60 border border-white/6 rounded-lg px-4 py-2.5 mb-3 text-center">
                <div className="text-[11px] text-muted mb-0.5">Total Output Value</div>
                <div className="text-lg font-mono font-bold text-btc-orange">
                  ₿ {formatBtc(totalOut)}
                </div>
              </div>
            )}

            {/* 3. Flow Diagram */}
            {(sankeyInputs.length > 0 || sankeyOutputs.length > 0) && (
              <div className="mb-3 border border-white/6 rounded-lg overflow-hidden bg-dark-surface/30 p-2">
                <div className="text-[11px] text-muted font-bold tracking-wide mb-1 px-1">FLOW</div>
                <TxSankeyDiagram inputs={sankeyInputs} outputs={sankeyOutputs} fee={fee || 0} />
              </div>
            )}

            {/* 4. Inputs & Outputs — 2열 나란히 */}
            <div className="grid grid-cols-2 gap-3 mb-3 max-sm:grid-cols-1">
              {/* Inputs */}
              <div>
                <div className="text-tx-blue text-xs font-bold mb-1.5 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                  INPUTS ({detail.vin?.length ?? '?'})
                </div>
                <div className="bg-dark-surface/40 rounded-lg border border-white/6 overflow-hidden">
                  {detail.vin?.slice(0, inputLimit).map((inp, i) => (
                    <div key={i} className="text-xs py-1.5 px-2 border-b border-dark-surface last:border-b-0">
                      <div className="flex items-center gap-1">
                        <span className="text-muted text-[10px] min-w-[16px]">{i}</span>
                        {inp.isCoinbase
                          ? <span className="text-btc-orange font-bold">Coinbase</span>
                          : inp.prevout?.scriptpubkey_address
                            ? <span
                                className={`truncate max-w-[200px] text-text-secondary ${onAddressClick ? 'cursor-pointer hover:text-tx-blue' : ''}`}
                                onClick={() => handleAddrClick(inp.prevout.scriptpubkey_address)}
                              >
                                {inp.prevout.scriptpubkey_address}
                              </span>
                            : <span className="text-text-dim">
                                {inp.txid ? `${inp.txid.slice(0, 10)}…:${inp.vout}` : '(unknown)'}
                              </span>
                        }
                      </div>
                      <div className="flex items-center justify-between mt-0.5 ml-4">
                        {inp.prevout?.scriptpubkey_type && (
                          <span className="text-[10px] text-muted bg-white/5 px-1 rounded">
                            {scriptTypeLabel(inp.prevout.scriptpubkey_type)}
                          </span>
                        )}
                        {inp.prevout?.value != null && inp.prevout.value > 0 && (
                          <span className="text-btc-orange text-[11px] ml-auto shrink-0">
                            {formatBtc(inp.prevout.value)} BTC
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {detail.vin?.length > 5 && (
                    <button
                      onClick={() => setShowAllInputs(!showAllInputs)}
                      className="w-full text-tx-blue text-[11px] cursor-pointer bg-transparent
                                 border-none hover:bg-white/5 py-1.5 text-center"
                    >
                      {showAllInputs ? '접기 ▴' : `… ${detail.vin.length - 5}개 더 ▾`}
                    </button>
                  )}
                </div>
              </div>

              {/* Outputs */}
              <div>
                <div className="text-tx-blue text-xs font-bold mb-1.5 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                  OUTPUTS ({detail.vout?.length ?? '?'})
                </div>
                <div className="bg-dark-surface/40 rounded-lg border border-white/6 overflow-hidden">
                  {detail.vout?.slice(0, outputLimit).map((out, i) => (
                    <div key={i} className="text-xs py-1.5 px-2 border-b border-dark-surface last:border-b-0">
                      <div className="flex items-center gap-1">
                        <span className="text-muted text-[10px] min-w-[16px]">{i}</span>
                        {out.scriptpubkey_address
                          ? <span
                              className={`truncate max-w-[200px] text-text-secondary ${onAddressClick ? 'cursor-pointer hover:text-tx-blue' : ''}`}
                              onClick={() => handleAddrClick(out.scriptpubkey_address)}
                            >
                              {out.scriptpubkey_address}
                            </span>
                          : <span className="text-text-dim">OP_RETURN</span>
                        }
                      </div>
                      <div className="flex items-center justify-between mt-0.5 ml-4">
                        {out.scriptpubkey_type && (
                          <span className="text-[10px] text-muted bg-white/5 px-1 rounded">
                            {scriptTypeLabel(out.scriptpubkey_type)}
                          </span>
                        )}
                        {out.value != null && (
                          <span className="text-success text-[11px] ml-auto shrink-0">
                            {formatBtc(out.value)} BTC
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {detail.vout?.length > 5 && (
                    <button
                      onClick={() => setShowAllOutputs(!showAllOutputs)}
                      className="w-full text-tx-blue text-[11px] cursor-pointer bg-transparent
                                 border-none hover:bg-white/5 py-1.5 text-center"
                    >
                      {showAllOutputs ? '접기 ▴' : `… ${detail.vout.length - 5}개 더 ▾`}
                    </button>
                  )}
                </div>
                {/* Total output 합계 */}
                {totalOut != null && (
                  <div className="text-right text-[11px] text-muted mt-1 pr-2">
                    Total: <span className="text-success font-bold">{formatBtc(totalOut)} BTC</span>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Details (접이식) */}
            <div className="border-t border-white/8 pt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-muted text-xs font-bold cursor-pointer bg-transparent border-none
                           hover:text-text-secondary w-full text-left py-1"
              >
                {showDetails ? '▾' : '▸'} DETAILS
              </button>
              {showDetails && (
                <div className="mt-1 space-y-1 text-xs">
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Version</span>
                    <span className="text-text-primary">{detail.version ?? '—'}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Locktime</span>
                    <span className="text-text-primary">{detail.locktime ?? '—'}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Size</span>
                    <span className="text-text-primary">{size != null ? `${size} B` : '—'}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Virtual Size</span>
                    <span className="text-text-primary">{vsize ? `${vsize} vB` : '—'}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted">Weight</span>
                    <span className="text-text-primary">{weight != null ? `${weight} WU` : '—'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* mempool.space 외부 링크 */}
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
          </>
        )}

        {!detail && !loading && (
          <div className="space-y-1">
            <div className="flex justify-between py-1 border-b border-dark-surface">
              <span className="text-muted text-sm">Inputs</span>
              <span className="text-sm">{tx?.data?.vin ?? '?'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-dark-surface">
              <span className="text-muted text-sm">Outputs</span>
              <span className="text-sm">{tx?.data?.vout ?? '?'}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
