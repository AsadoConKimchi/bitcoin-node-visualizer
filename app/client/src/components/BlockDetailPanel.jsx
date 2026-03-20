import React, { useEffect, useState } from 'react';

const REST_BASE = 'https://mempool.space/api';
const PAGE_SIZE = 25;

function Row({ label, value, mono, highlight }) {
  return (
    <div className="flex justify-between py-1 border-b border-dark-surface gap-3">
      <span className="text-muted shrink-0 text-sm">{label}</span>
      <span className={`text-right text-sm ${highlight ? 'text-btc-orange' : 'text-text-primary'}
                       ${mono ? 'break-all text-xs' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function FeeBar({ feeRange }) {
  if (!feeRange?.length) return null;
  const [min, , , med, , , max] = feeRange;
  return (
    <div className="my-2">
      <div className="text-muted text-xs mb-1">수수료 분포 (sat/vB)</div>
      <div className="flex gap-0.5 items-end h-8">
        {feeRange.map((fee, i) => {
          const pct = Math.round((fee / max) * 100);
          const color = fee >= 30 ? '#ef4444' : fee >= 15 ? '#f59e0b' : fee >= 8 ? '#22c55e' : '#60a5fa';
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-full rounded-sm" style={{ height: `${pct}%`, minHeight: 3, background: color }} />
              <div className="text-muted-dim text-[8px] mt-0.5">{Math.round(fee)}</div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-text-dim text-xs mt-0.5">
        <span>min: {Math.round(min)}</span>
        <span>중간: {Math.round(med)}</span>
        <span>max: {Math.round(max)}</span>
      </div>
    </div>
  );
}

// SegWit/Taproot 비율 계산
function SegwitStats({ txids, blockHash, sourceType }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!blockHash) return;
    // 블록 TX 일부만 샘플링하여 통계 계산 (전체 조회는 너무 느림)
    const sampleSize = Math.min(txids.length, 10);
    if (sampleSize === 0) return;

    const sample = txids.slice(0, sampleSize);
    const txUrl = (txid) => sourceType === 'server' ? `/api/tx/${txid}` : `${REST_BASE}/tx/${txid}`;
    Promise.all(sample.map(txid =>
      fetch(txUrl(txid)).then(r => r.ok ? r.json() : null).catch(() => null)
    )).then(rawTxs => {
      // 서버 모드: RPC 형식 정규화
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
    <div className="mt-2 p-2 bg-dark-surface rounded border border-dark-border">
      <div className="text-muted text-xs mb-1.5">TX 유형 비율 (샘플 {stats.sampleSize}개)</div>
      <div className="flex gap-1 h-3 rounded overflow-hidden mb-1">
        {stats.legacy > 0 && <div className="bg-orange-500" style={{ width: `${stats.legacy}%` }} />}
        {stats.segwit > 0 && <div className="bg-blue-400" style={{ width: `${stats.segwit}%` }} />}
        {stats.taproot > 0 && <div className="bg-purple-400" style={{ width: `${stats.taproot}%` }} />}
      </div>
      <div className="flex justify-between text-[9px]">
        <span className="text-orange-500">Legacy {stats.legacy}%</span>
        <span className="text-blue-400">SegWit {stats.segwit}%</span>
        <span className="text-purple-400">Taproot {stats.taproot}%</span>
      </div>
    </div>
  );
}

// RPC 응답(getblock verbosity=1)을 mempool.space 형식으로 정규화
function normalizeRpcBlock(rpc) {
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
    // extras는 RPC에서 직접 제공 불가
    extras: null,
    // txid 목록 (verbosity=1)
    _txids: rpc.tx || [],
  };
}

export default function BlockDetailPanel({ block, onClose, onTxClick, sourceType }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [txids, setTxids] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showTxList, setShowTxList] = useState(false);
  const [txPage, setTxPage] = useState(1);

  useEffect(() => {
    if (!block?.hash) return;
    setLoading(true);
    setError(null);

    const url = sourceType === 'server'
      ? `/api/block/${block.hash}`
      : `${REST_BASE}/block/${block.hash}`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const normalized = sourceType === 'server' ? normalizeRpcBlock(data) : data;
        setDetail(normalized);
        // 서버 모드: txid 목록이 응답에 포함됨
        if (sourceType === 'server' && normalized._txids?.length) {
          setTxids(normalized._txids);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [block?.hash, sourceType]);

  const loadTxids = () => {
    if (txids.length > 0) {
      setShowTxList(!showTxList);
      return;
    }
    setTxLoading(true);
    setShowTxList(true);

    if (sourceType === 'server') {
      // 서버 모드: txids는 이미 블록 응답에 포함됨
      setTxLoading(false);
      return;
    }

    fetch(`${REST_BASE}/block/${block.hash}/txids`)
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
  const rewardSats = detail?.extras?.reward;
  const rewardBTC = rewardSats != null ? (rewardSats / 1e8).toFixed(8) + ' BTC' : null;
  const feeRange = detail?.extras?.feeRange ?? block?.feeRange;
  const txCount = detail?.tx_count ?? block?.txCount;

  // 페이지네이션
  const visibleTxids = txids.slice(0, txPage * PAGE_SIZE);
  const hasMore = visibleTxids.length < txids.length;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[19]" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[400px] max-h-[75vh] overflow-y-auto bg-panel-bg-solid
                      border border-btc-orange rounded-lg px-5 py-4
                      font-mono text-sm text-text-primary backdrop-blur-md z-20
                      shadow-[0_0_40px_rgba(247,147,26,0.2)]
                      max-sm:w-[calc(100vw-24px)] max-sm:max-h-[80vh]">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-btc-orange/25">
          <div>
            <div className="text-btc-orange font-bold text-base">
              블록 #{block?.height?.toLocaleString() ?? '?'}
            </div>
            {block?.pool && (
              <div className="text-muted text-xs mt-0.5">채굴: {block.pool}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border border-muted-dim rounded text-muted
                      cursor-pointer px-2 py-0.5 font-mono text-sm hover:text-text-primary"
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

        <Row label="Hash" value={block?.hash} mono />
        <Row label="높이" value={block?.height?.toLocaleString()} highlight />
        <Row label="TX 수" value={txCount?.toLocaleString()} />
        {ts && <Row label="시각" value={ts} />}
        {sizeKB && <Row label="크기" value={sizeKB} />}
        {weightMWU && <Row label="Weight" value={weightMWU} />}
        {rewardBTC && <Row label="블록 보상" value={rewardBTC} highlight />}

        {(loading || feeRange) && <FeeBar feeRange={feeRange} />}

        {/* SegWit/Taproot 비율 */}
        {txids.length > 0 && <SegwitStats txids={txids} blockHash={block?.hash} sourceType={sourceType} />}

        {/* TX 목록 */}
        {txCount > 0 && (
          <div className="mt-2.5">
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
                    className="text-xs text-text-secondary py-0.5 px-1 border-b border-dark-surface
                              cursor-pointer flex items-center gap-1.5 hover:bg-btc-orange/5"
                  >
                    <span className="text-text-dim min-w-[20px]">{i === 0 ? 'CB' : i}</span>
                    <span className="font-mono">{txid.slice(0, 12)}…{txid.slice(-8)}</span>
                  </div>
                ))}
                {hasMore && (
                  <button
                    onClick={() => setTxPage(p => p + 1)}
                    className="w-full text-center text-btc-orange text-xs py-2 cursor-pointer
                              bg-transparent border border-btc-orange/20 rounded mt-1.5
                              hover:bg-btc-orange/10"
                  >
                    더 보기 ({(txids.length - visibleTxids.length).toLocaleString()}개 남음)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {sourceType !== 'server' && (
          <div className="mt-3 text-center">
            <a
              href={`https://mempool.space/block/${block?.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-btc-orange text-xs no-underline border border-btc-orange/25
                        px-3 py-1 rounded hover:bg-btc-orange/10"
            >
              mempool.space에서 보기 ↗
            </a>
          </div>
        )}
      </div>
    </>
  );
}
