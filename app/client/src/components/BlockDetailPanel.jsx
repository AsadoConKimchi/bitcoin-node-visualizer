import React, { useEffect, useState, useRef, useMemo } from 'react';
import { CopyButton, relativeTime, formatBtc, calculateSubsidy } from '../utils/format.jsx';
import { feeColor, FEE_LEGEND } from '../utils/colors.js';
import { normalizeRpcBlock } from '../utils/normalize.js';

const REST_BASE = 'https://mempool.space/api';
const PAGE_SIZE = 25;

// SegWit/Taproot 비율 계산
function SegwitStats({ txids, blockHash, sourceType }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!blockHash) return;
    const sampleSize = Math.min(txids.length, 50);
    if (sampleSize === 0) return;

    // 균등 간격 추출 (편향 방지)
    const step = txids.length / sampleSize;
    const sample = Array.from({ length: sampleSize }, (_, i) =>
      txids[Math.floor(i * step)]
    );
    const txUrl = (txid) => sourceType === 'server' ? `/api/tx/${txid}` : `${REST_BASE}/tx/${txid}`;
    Promise.all(sample.map(txid =>
      fetch(txUrl(txid)).then(r => r.ok ? r.json() : null).catch(() => null)
    )).then(rawTxs => {
      const txs = rawTxs.map(tx => {
        if (!tx) return null;
        if (sourceType === 'server' && tx.vout?.[0]?.scriptPubKey) {
          return {
            ...tx,
            vin: (tx.vin || []).map(v => ({
              ...v,
              prevout: v.prevout ? {
                ...v.prevout,
                scriptpubkey_type: v.prevout.scriptPubKey?.type,
              } : null,
            })),
            vout: (tx.vout || []).map(v => ({
              ...v,
              scriptpubkey_type: v.scriptPubKey?.type,
            })),
          };
        }
        return tx;
      });
      const valid = txs.filter(Boolean);
      if (valid.length === 0) return;

      let segwit = 0, taproot = 0, legacy = 0;
      valid.forEach(tx => {
        const hasWitness = tx.vin?.some(v => v.witness?.length > 0);
        const hasTaproot = tx.vin?.some(v => v.prevout?.scriptpubkey_type === 'v1_p2tr') ||
                          tx.vout?.some(v => v.scriptpubkey_type === 'v1_p2tr');
        if (hasTaproot) taproot++;
        else if (hasWitness) segwit++;
        else legacy++;
      });

      setStats({
        segwit: Math.round((segwit / valid.length) * 100),
        taproot: Math.round((taproot / valid.length) * 100),
        legacy: Math.round((legacy / valid.length) * 100),
        sampleSize: valid.length,
      });
    });
  }, [blockHash, txids.length]);

  if (!stats) return null;

  return (
    <div className="p-2 bg-dark-surface rounded border border-dark-border">
      <div className="text-muted text-xs mb-1.5">TX 유형 ({stats.sampleSize} / {txids.length})</div>
      <div className="flex gap-1 h-3 rounded overflow-hidden mb-1">
        {stats.legacy > 0 && <div className="bg-btc-orange" style={{ width: `${stats.legacy}%` }} />}
        {stats.segwit > 0 && <div className="bg-tx-blue" style={{ width: `${stats.segwit}%` }} />}
        {stats.taproot > 0 && <div className="bg-block-purple" style={{ width: `${stats.taproot}%` }} />}
      </div>
      <div className="flex justify-between text-label-xs">
        <span className="text-btc-orange">Legacy {stats.legacy}%</span>
        <span className="text-tx-blue">SegWit {stats.segwit}%</span>
        <span className="text-block-purple">Taproot {stats.taproot}%</span>
      </div>
    </div>
  );
}

// Block Treemap — 모든 TX를 밀집 그리드로 시각화, 샘플에 fee 색상 적용
function BlockTreemap({ txids, blockHash, sourceType }) {
  const [feeMap, setFeeMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  const total = txids?.length || 0;

  // 균등 간격으로 100개 샘플 fetch → fee rate 정보 수집
  useEffect(() => {
    if (!total) return;
    setLoading(true);

    const sampleSize = Math.min(total, 100);
    const step = total / sampleSize;
    const sampleIndices = Array.from({ length: sampleSize }, (_, i) => Math.floor(i * step));
    const sampleTxids = sampleIndices.map(i => txids[i]);

    const txUrl = (txid) => sourceType === 'server' ? `/api/tx/${txid}` : `${REST_BASE}/tx/${txid}`;

    // 동시 요청 제한: 20개씩 배치
    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < sampleTxids.length; i += batchSize) {
      batches.push(sampleTxids.slice(i, i + batchSize));
    }

    let cancelled = false;
    (async () => {
      const map = new Map();
      for (const batch of batches) {
        if (cancelled) return;
        const results = await Promise.all(batch.map(txid =>
          fetch(txUrl(txid)).then(r => r.ok ? r.json() : null).catch(() => null)
        ));
        results.forEach(tx => {
          if (!tx) return;
          const w = tx.weight || (tx.size ? tx.size * 4 : 400);
          const vs = w / 4;
          let fee = tx.fee;
          if (fee == null && sourceType === 'server' && tx.fee != null) {
            fee = Math.round(tx.fee * 1e8);
          }
          const feeRate = fee != null && vs > 0 ? fee / vs : 1;
          map.set(tx.txid, feeRate);
        });
      }
      if (!cancelled) {
        setFeeMap(map);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [total, blockHash]);

  // Canvas 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !total) return;

    const container = canvas.parentElement;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 셀 크기 동적 계산
    const cellSize = total > 3000 ? 3 : total > 2000 ? 4 : total > 1000 ? 5 : total > 500 ? 6 : total > 200 ? 7 : 9;
    const gap = 1;
    const cols = Math.floor(w / (cellSize + gap)) || 1;
    const defaultColor = '#1e2328';

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellSize + gap);
      const y = row * (cellSize + gap);

      if (y > h) break;

      const txid = txids[i];
      const fr = feeMap.get(txid);

      if (fr != null) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = feeColor(fr);
      } else {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = defaultColor;
      }

      ctx.fillRect(x, y, cellSize, cellSize);
    }

    ctx.globalAlpha = 1;
  }, [txids, feeMap, total]);

  if (!total) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted text-label">
        TX 데이터 없음
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden rounded">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-muted text-label-xs z-10 pointer-events-none">
          {total.toLocaleString()}개 TX 로딩 중…
        </div>
      )}
      <div className="w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      {/* TX 수 오버레이 */}
      <div className="absolute bottom-1 right-1.5 text-label-xs text-white/40 pointer-events-none">
        {total.toLocaleString()} TX
      </div>
    </div>
  );
}

// Fee 분포 바
function FeeBar({ feeRange }) {
  if (!feeRange?.length) return null;
  const [min, , , med, , , max] = feeRange;
  return (
    <div>
      <div className="text-muted text-xs mb-1">수수료 분포 (sat/vB)</div>
      <div className="flex gap-0.5 items-end h-8">
        {feeRange.map((fee, i) => {
          const pct = Math.round((fee / max) * 100);
          const color = feeColor(fee);
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-full rounded-sm" style={{ height: `${pct}%`, minHeight: 3, background: color }} />
              <div className="text-muted-dim text-label-xs mt-0.5">{Math.round(fee)}</div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-text-dim text-xs mt-0.5">
        <span>min: {Math.round(min)}</span>
        <span>mid: {Math.round(med)}</span>
        <span>max: {Math.round(max)}</span>
      </div>
    </div>
  );
}

// 정보 행
function InfoRow({ label, value, mono, highlight, copyable }) {
  return (
    <div className="flex justify-between py-1 gap-2 min-w-0">
      <span className="text-muted shrink-0 text-xs">{label}</span>
      <span className={`text-right text-xs flex items-center gap-1 min-w-0
                       ${highlight ? 'text-btc-orange font-bold' : 'text-text-primary'}
                       ${mono ? 'text-label' : ''}`}>
        {mono
          ? <span className="truncate min-w-0" title={value}>{value ?? '—'}</span>
          : (value ?? '—')
        }
        {copyable && value && <CopyButton text={value} />}
      </span>
    </div>
  );
}

export default function BlockDetailPanel({ block, onClose, onTxClick, sourceType, onAddressClick }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [txids, setTxids] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showTxList, setShowTxList] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [txPage, setTxPage] = useState(1);

  // 현재 블록 height 추적 (prev/next 네비게이션)
  const [navHeight, setNavHeight] = useState(block?.height ?? null);
  const [navHash, setNavHash] = useState(block?.hash ?? null);

  useEffect(() => {
    const hash = navHash || block?.hash;
    if (!hash) return;
    setLoading(true);
    setError(null);
    setShowTxList(false);
    setTxPage(1);

    const url = sourceType === 'server'
      ? `/api/block/${hash}`
      : `${REST_BASE}/block/${hash}`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const normalized = sourceType === 'server' ? normalizeRpcBlock(data) : data;
        setDetail(normalized);
        setNavHeight(normalized.height);
        if (sourceType === 'server' && normalized._txids?.length) {
          setTxids(normalized._txids);
        } else {
          // mempool 모드: txids를 바로 fetch (Treemap용)
          setTxids([]);
          fetch(`${REST_BASE}/block/${hash}/txids`)
            .then(r => r.ok ? r.json() : [])
            .then(ids => setTxids(ids || []))
            .catch(() => {});
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [navHash, sourceType]);

  // 이전/다음 블록 네비게이션
  const navigateBlock = (delta) => {
    const targetHeight = (navHeight ?? block?.height ?? 0) + delta;
    if (targetHeight < 0) return;

    fetch(`${REST_BASE}/block-height/${targetHeight}`)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(hash => {
        setNavHash(hash);
        setNavHeight(targetHeight);
      })
      .catch(() => console.warn('블록 네비게이션 실패'));
  };

  const loadTxids = () => {
    if (txids.length > 0) {
      setShowTxList(!showTxList);
      return;
    }
    setTxLoading(true);
    setShowTxList(true);

    if (sourceType === 'server') {
      setTxLoading(false);
      return;
    }

    const hash = navHash || block?.hash;
    fetch(`${REST_BASE}/block/${hash}/txids`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setTxids(data || []);
        setTxLoading(false);
      })
      .catch(() => setTxLoading(false));
  };

  const ts = detail?.timestamp
    ? new Date(detail.timestamp * 1000).toLocaleString('ko-KR')
    : null;

  const sizeKB = detail?.size ? (detail.size / 1024).toFixed(1) + ' KB' : null;
  const weightMWU = detail?.weight ? (detail.weight / 1_000_000).toFixed(3) + ' MWU' : null;
  const feeRange = detail?.extras?.feeRange ?? block?.feeRange;
  const txCount = detail?.tx_count ?? block?.txCount;

  // 블록 보상 계산
  const height = navHeight ?? block?.height;
  const subsidy = calculateSubsidy(height);
  const totalFees = detail?.extras?.totalFees;
  const rewardSats = detail?.extras?.reward ?? (totalFees != null ? subsidy + totalFees : null);
  const medianFee = detail?.extras?.medianFee;
  const pool = detail?.extras?.pool?.name ?? block?.pool;

  // 페이지네이션
  const visibleTxids = txids.slice(0, txPage * PAGE_SIZE);
  const hasMore = visibleTxids.length < txids.length;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[var(--z-modal-backdrop)]" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[780px] max-h-[85vh] overflow-y-auto bg-panel-bg-solid
                      border border-white/10 rounded-xl px-5 py-4
                      font-mono text-sm text-text-primary backdrop-blur-md z-[var(--z-modal)]
                      max-sm:w-[calc(100vw-16px)] max-sm:max-h-[90vh]"
           style={{ boxShadow: 'var(--shadow-modal)' }}>

        {/* 1. Block Navigation Header */}
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateBlock(-1)}
              className="bg-transparent border border-white/10 rounded text-muted
                        cursor-pointer px-2 py-0.5 text-sm hover:text-text-primary hover:bg-white/5"
            >
              ‹
            </button>
            <div>
              <div className="text-btc-orange font-bold text-base">
                Block #{(navHeight ?? block?.height)?.toLocaleString() ?? '?'}
              </div>
              {pool && (
                <div className="text-muted text-xs mt-0.5">Mined by {pool}</div>
              )}
            </div>
            <button
              onClick={() => navigateBlock(1)}
              className="bg-transparent border border-white/10 rounded text-muted
                        cursor-pointer px-2 py-0.5 text-sm hover:text-text-primary hover:bg-white/5"
            >
              ›
            </button>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border border-white/10 rounded text-muted
                      cursor-pointer px-2 py-0.5 text-sm hover:text-text-primary hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {loading && (
          <div className="text-text-dim text-center py-4">로드 중…</div>
        )}

        {error && (
          <div className="text-error text-center py-2 text-xs">로드 실패: {error}</div>
        )}

        {detail && (
          <>
            {/* 2. 2열 Info Layout */}
            <div className="grid grid-cols-5 gap-3 mb-3 max-sm:grid-cols-1">
              {/* 좌측 (~45%) — 정보 목록 */}
              <div className="col-span-3 space-y-0.5 max-sm:col-span-1">
                <InfoRow label="Hash" value={detail.id || block?.hash} mono copyable />
                {ts && <InfoRow label="Timestamp" value={`${ts} (${relativeTime(detail.timestamp)})`} />}
                <InfoRow label="TX Count" value={txCount?.toLocaleString()} />
                {sizeKB && <InfoRow label="Size" value={sizeKB} />}
                {weightMWU && <InfoRow label="Weight" value={weightMWU} />}

                {/* Fee 관련 */}
                {feeRange && (
                  <InfoRow label="Fee Span" value={`${Math.round(feeRange[0])} – ${Math.round(feeRange[feeRange.length - 1])} sat/vB`} />
                )}
                {medianFee != null && (
                  <InfoRow label="Median Fee" value={`${medianFee.toFixed(1)} sat/vB`} />
                )}
                {totalFees != null && (
                  <InfoRow label="Total Fees" value={`${formatBtc(totalFees)} BTC`} highlight />
                )}

                {/* 보상 */}
                <InfoRow label="Subsidy" value={`${formatBtc(subsidy)} BTC`} />
                {rewardSats != null && (
                  <InfoRow label="Subsidy + Fees" value={`${formatBtc(rewardSats)} BTC`} highlight />
                )}

                {/* SegWit 통계 */}
                {txids.length > 0 && (
                  <div className="mt-2">
                    <SegwitStats txids={txids} blockHash={navHash || block?.hash} sourceType={sourceType} />
                  </div>
                )}
              </div>

              {/* 우측 (~55%) — Block Treemap + Fee 분포 */}
              <div className="col-span-2 space-y-2 max-sm:col-span-1">
                {/* Treemap */}
                <div className="bg-dark-surface/60 border border-dark-border rounded-lg p-2">
                  <div className="text-label text-muted font-bold mb-1">TX FEE RATE MAP</div>
                  <div className="h-[200px]">
                    <BlockTreemap
                      txids={txids.length > 0 ? txids : (detail._txids || [])}
                      blockHash={navHash || block?.hash}
                      sourceType={sourceType}
                    />
                  </div>
                  {/* Fee 색상 범례 */}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {FEE_LEGEND.map(l => (
                      <div key={l.label} className="flex items-center gap-0.5">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: l.color }} />
                        <span className="text-label-xs text-muted">{l.label}</span>
                      </div>
                    ))}
                    <span className="text-label-xs text-muted ml-1">sat/vB</span>
                    <div className="flex items-center gap-0.5 ml-1.5 border-l border-dark-border pl-1.5">
                      <div className="w-2 h-2 rounded-sm bg-dark-surface opacity-35" />
                      <span className="text-label-xs text-muted">미확인</span>
                    </div>
                  </div>
                </div>

                {/* Fee 분포 바 차트 */}
                {feeRange && (
                  <div className="bg-dark-surface/60 border border-dark-border rounded-lg p-2">
                    <FeeBar feeRange={feeRange} />
                  </div>
                )}
              </div>
            </div>

            {/* 3. Details (접이식) */}
            <div className="border-t border-dark-border pt-2 mb-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-muted text-xs font-bold cursor-pointer bg-transparent border-none
                           hover:text-text-secondary w-full text-left py-1"
              >
                {showDetails ? '▾' : '▸'} DETAILS
              </button>
              {showDetails && (
                <div className="mt-1 space-y-0.5 text-xs">
                  <InfoRow label="Difficulty" value={detail.difficulty?.toLocaleString()} />
                  <InfoRow label="Nonce" value={detail.nonce?.toLocaleString()} />
                  <InfoRow label="Bits" value={detail.bits} />
                  <InfoRow label="Version" value={detail.version != null ? `0x${detail.version.toString(16)}` : null} />
                  <InfoRow label="Merkle Root" value={detail.merkle_root} mono copyable />
                  <InfoRow label="Previous Block" value={detail.previousblockhash} mono copyable />
                </div>
              )}
            </div>

            {/* 4. TX 목록 */}
            {txCount > 0 && (
              <div className="border-t border-dark-border pt-2">
                <div
                  onClick={loadTxids}
                  className="text-btc-orange text-xs font-bold cursor-pointer py-1 select-none hover:text-btc-orange/80"
                >
                  {showTxList ? '▾' : '▸'} TRANSACTIONS ({txCount?.toLocaleString()})
                </div>

                {showTxList && (
                  <div className="mt-1">
                    {txLoading && (
                      <div className="text-text-dim text-xs py-2 text-center">TX 목록 로딩 중…</div>
                    )}
                    {visibleTxids.map((txid, i) => (
                      <div
                        key={txid}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTxClick?.({ txid, data: {} });
                        }}
                        className="text-xs text-text-secondary py-1 px-2 border-b border-dark-surface
                                  cursor-pointer flex items-center gap-2 hover:bg-btc-orange/5 rounded"
                      >
                        <span className={`text-text-dim min-w-[24px] ${i === 0 ? 'text-btc-orange font-bold' : ''}`}>
                          {i === 0 ? 'CB' : i}
                        </span>
                        <span className="font-mono flex-1 truncate">{txid}</span>
                      </div>
                    ))}
                    {hasMore && (
                      <button
                        onClick={() => setTxPage(p => p + 1)}
                        className="w-full text-center text-btc-orange text-xs py-2 cursor-pointer
                                  bg-transparent border border-white/10 rounded mt-1.5
                                  hover:bg-white/5"
                      >
                        더 보기 ({(txids.length - visibleTxids.length).toLocaleString()}개 남음)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* mempool.space 링크 */}
            <div className="mt-3 text-center">
              <a
                href={`https://mempool.space/block/${navHash || block?.hash}`}
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
      </div>
    </>
  );
}
