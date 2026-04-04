import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { CopyButton, relativeTime, formatBtc, calculateSubsidy } from '../utils/format.jsx';
import { feeColor, FEE_LEGEND } from '../utils/colors.js';
import { normalizeRpcBlock, normalizeRpcTx } from '../utils/normalize.js';
import { squarify } from '../utils/treemap.js';

const REST_BASE = 'https://mempool.space/api';
const PAGE_SIZE = 25;

// feeRange 7-percentile 기반 synthetic cell 생성
function generateSyntheticCells(mempoolBlock) {
  if (!mempoolBlock) return [];
  const { nTx, feeRange } = mempoolBlock;
  if (!nTx || !feeRange?.length) return [];

  // feeRange: [min, 10th, 25th, median, 75th, 90th, max] — 6구간
  const segments = [];
  for (let i = 0; i < feeRange.length - 1; i++) {
    segments.push({ lo: feeRange[i], hi: feeRange[i + 1] });
  }

  const perSeg = Math.ceil(nTx / segments.length);
  const cells = [];
  let id = 0;

  for (let s = segments.length - 1; s >= 0; s--) {
    const { lo, hi } = segments[s];
    const count = s === 0 ? nTx - cells.length : perSeg;
    for (let j = 0; j < count && cells.length < nTx; j++) {
      const feeRate = lo + Math.random() * (hi - lo);
      // 비트코인 TX vsize 분포: 중위 ~140, 범위 100~5000
      const vsize = 100 + Math.random() * Math.random() * 2000;
      cells.push({
        id: id++,
        feeRate,
        targetFeeRate: feeRate,
        currentFeeRate: feeRate,
        vsize,
        alpha: 1,
      });
    }
  }

  // 고수수료 우선 정렬
  cells.sort((a, b) => b.feeRate - a.feeRate);
  return cells;
}

// Pending Block Treemap — 실시간 진동 애니메이션
function PendingBlockTreemap({ mempoolBlock }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const cellsRef = useRef([]);
  const rectsRef = useRef([]);
  const prevCellsLenRef = useRef('');
  const rafRef = useRef(null);
  const prevNTxRef = useRef(0);

  // mempoolBlock 변경 → 셀 업데이트
  useEffect(() => {
    if (!mempoolBlock) return;
    const { nTx, feeRange } = mempoolBlock;
    if (!nTx) return;

    const prev = cellsRef.current;
    const prevNTx = prevNTxRef.current;
    prevNTxRef.current = nTx;

    if (prev.length === 0) {
      // 초기 생성
      cellsRef.current = generateSyntheticCells(mempoolBlock);
      return;
    }

    // nTx 증가 → 새 셀 추가 (alpha=0으로 fade-in)
    if (nTx > prev.length) {
      const diff = nTx - prev.length;
      const segments = [];
      for (let i = 0; i < feeRange.length - 1; i++) {
        segments.push({ lo: feeRange[i], hi: feeRange[i + 1] });
      }
      for (let i = 0; i < diff; i++) {
        const seg = segments[Math.floor(Math.random() * segments.length)];
        const feeRate = seg.lo + Math.random() * (seg.hi - seg.lo);
        const vsize = 100 + Math.random() * Math.random() * 2000;
        prev.push({
          id: prev.length,
          feeRate,
          targetFeeRate: feeRate,
          currentFeeRate: feeRate,
          vsize,
          alpha: 0, // fade-in 시작
        });
      }
      prev.sort((a, b) => b.feeRate - a.feeRate);
    }

    // nTx 감소 → 저수수료 셀 제거
    if (nTx < prev.length) {
      prev.sort((a, b) => b.feeRate - a.feeRate);
      cellsRef.current = prev.slice(0, nTx);
    }

    // feeRange 변경 → targetFeeRate 업데이트
    if (feeRange?.length) {
      const segments = [];
      for (let i = 0; i < feeRange.length - 1; i++) {
        segments.push({ lo: feeRange[i], hi: feeRange[i + 1] });
      }
      const perSeg = Math.ceil(cellsRef.current.length / segments.length);
      cellsRef.current.forEach((cell, idx) => {
        const segIdx = Math.min(Math.floor(idx / perSeg), segments.length - 1);
        const seg = segments[segments.length - 1 - segIdx];
        cell.targetFeeRate = seg.lo + Math.random() * (seg.hi - seg.lo);
      });
    }
  }, [mempoolBlock?.nTx, mempoolBlock?.feeRange]);

  // rAF 애니메이션 루프
  useEffect(() => {
    const animate = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const cells = cellsRef.current;
      if (!canvas || !container || !cells.length) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // cellsRef 변경 또는 컨테이너 크기 변경 시 squarify 재계산
      const sizeKey = `${cells.length}-${w}-${h}`;
      if (sizeKey !== prevCellsLenRef.current) {
        prevCellsLenRef.current = sizeKey;
        rectsRef.current = squarify(
          cells.map(c => ({ ...c, weight: c.vsize || 140 })),
          w, h
        );
      }

      ctx.clearRect(0, 0, w, h);

      const rects = rectsRef.current;
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const cell = cells[i];
        if (!cell) continue;

        // ±1px 랜덤 진동
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;

        // fee 색상 lerp
        cell.currentFeeRate += (cell.targetFeeRate - cell.currentFeeRate) * 0.05;

        // alpha fade-in
        if (cell.alpha < 1) {
          cell.alpha = Math.min(1, cell.alpha + 1 / 30);
        }

        ctx.globalAlpha = cell.alpha * 0.9;
        ctx.fillStyle = feeColor(cell.currentFeeRate);
        ctx.fillRect(rect.x + jitterX, rect.y + jitterY, rect.w - 0.5, rect.h - 0.5);
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!mempoolBlock?.nTx) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted text-label">
        대기 중인 TX 없음
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded">
      <canvas ref={canvasRef} className="block" role="img" aria-label="블록 내 트랜잭션 분포를 트리맵으로 시각화. 각 셀은 TX를 나타내며 색상은 수수료율입니다." />
      <div className="absolute bottom-1 right-1.5 text-label-xs text-white/40 pointer-events-none">
        ~{mempoolBlock.nTx.toLocaleString()} TX
      </div>
    </div>
  );
}

// SegWit/Taproot 비율 계산
// TX 유형 분포 바 (서버 집계 또는 mempool.space 샘플링)
function TxTypeBar({ txTypeStats, txids, blockHash, sourceType }) {
  const [stats, setStats] = useState(txTypeStats || null);

  // 서버 모드: txTypeStats 직접 사용, mempool 모드: 기존 샘플링 유지
  useEffect(() => {
    if (txTypeStats) { setStats(txTypeStats); return; }
    if (!blockHash || !txids?.length) return;

    const sampleSize = Math.min(txids.length, 50);
    const step = txids.length / sampleSize;
    const sample = Array.from({ length: sampleSize }, (_, i) => txids[Math.floor(i * step)]);
    Promise.all(sample.map(txid =>
      fetch(`${REST_BASE}/tx/${txid}`).then(r => r.ok ? r.json() : null).catch(() => null)
    )).then(txs => {
      const valid = txs.filter(Boolean);
      if (!valid.length) return;
      let legacy = 0, segwit = 0, taproot = 0;
      valid.forEach(tx => {
        const hasTaproot = tx.vin?.some(v => v.prevout?.scriptpubkey_type === 'v1_p2tr') ||
                          tx.vout?.some(v => v.scriptpubkey_type === 'v1_p2tr');
        const hasWitness = tx.vin?.some(v => v.witness?.length > 0);
        if (hasTaproot) taproot++; else if (hasWitness) segwit++; else legacy++;
      });
      setStats({ legacy, segwit, taproot, total: valid.length });
    });
  }, [blockHash, txids?.length, txTypeStats]);

  if (!stats) return null;
  const { legacy, segwit, taproot, total } = stats;
  const pLegacy = Math.round((legacy / total) * 100);
  const pSegwit = Math.round((segwit / total) * 100);
  const pTaproot = 100 - pLegacy - pSegwit;

  return (
    <div className="p-2 bg-dark-surface rounded border border-dark-border">
      <div className="text-muted text-sm mb-1.5">TX 유형</div>
      <div className="flex gap-1 h-3 rounded overflow-hidden mb-1">
        {pLegacy > 0 && <div className="bg-btc-orange" style={{ width: `${pLegacy}%` }} />}
        {pSegwit > 0 && <div className="bg-tx-blue" style={{ width: `${pSegwit}%` }} />}
        {pTaproot > 0 && <div className="bg-block-purple" style={{ width: `${pTaproot}%` }} />}
      </div>
      <div className="flex justify-between text-label-sm">
        <span className="text-btc-orange">Legacy {legacy}건 ({pLegacy}%)</span>
        <span className="text-tx-blue">SegWit {segwit}건 ({pSegwit}%)</span>
        <span className="text-block-purple">Taproot {taproot}건 ({pTaproot}%)</span>
      </div>
    </div>
  );
}

// Block Treemap — weight 비례 사각형 + fee rate 색상
function BlockTreemap({ txids, blockHash, sourceType, selectedTxid, onCellClick }) {
  const [txData, setTxData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const canvasRef = useRef(null);
  const rectsRef = useRef([]);

  // 캔버스 클릭 → 셀 찾기 → 콜백
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !rectsRef.current.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const found = rectsRef.current.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (found?.txid) onCellClick?.(found.txid);
  }, [onCellClick]);
  const containerRef = useRef(null);

  const total = txids?.length || 0;

  // 전체 TX fetch (mempool: 25개씩 배치, server: 개별 fetch)
  useEffect(() => {
    if (!total || !blockHash) return;
    setLoading(true);
    setTxData([]);
    setLoadedCount(0);

    let cancelled = false;

    if (sourceType === 'server') {
      // self-hosted: 개별 TX fetch (기존 방식 유지, vsize 추출 추가)
      const sampleSize = Math.min(total, 500);
      const step = total / sampleSize;
      const sampleTxids = Array.from({ length: sampleSize }, (_, i) => txids[Math.floor(i * step)]);

      const batchSize = 20;
      const batches = [];
      for (let i = 0; i < sampleTxids.length; i += batchSize) {
        batches.push(sampleTxids.slice(i, i + batchSize));
      }

      (async () => {
        const collected = [];
        for (const batch of batches) {
          if (cancelled) return;
          const results = await Promise.all(batch.map(txid =>
            fetch(`/api/tx/${txid}`).then(r => r.ok ? r.json() : null).catch(() => null)
          ));
          results.forEach(tx => {
            if (!tx) return;
            const w = tx.weight || (tx.size ? tx.size * 4 : 400);
            const vsize = w / 4;
            let fee = tx.fee;
            if (fee == null) fee = 0;
            const feeRate = fee != null && vsize > 0 ? fee / vsize : 1;
            collected.push({ txid: tx.txid, vsize, feeRate });
          });
          if (!cancelled) {
            setTxData([...collected]);
            setLoadedCount(collected.length);
          }
        }
        if (!cancelled) setLoading(false);
      })();
    } else {
      // mempool.space: /api/block/{hash}/txs/{startIndex} — 25개씩 전체 fetch
      const maxTx = Math.min(total, 5000);
      const totalPages = Math.ceil(maxTx / 25);
      const concurrency = 10;

      (async () => {
        const collected = [];
        for (let batch = 0; batch < totalPages; batch += concurrency) {
          if (cancelled) return;
          const pageIndices = [];
          for (let p = batch; p < Math.min(batch + concurrency, totalPages); p++) {
            pageIndices.push(p * 25);
          }
          const results = await Promise.all(pageIndices.map(startIdx =>
            fetch(`${REST_BASE}/block/${blockHash}/txs/${startIdx}`)
              .then(r => r.ok ? r.json() : [])
              .catch(() => [])
          ));
          for (const txs of results) {
            for (const tx of txs) {
              const w = tx.weight || (tx.size ? tx.size * 4 : 400);
              const vsize = w / 4;
              const fee = tx.fee ?? 0;
              const feeRate = vsize > 0 ? fee / vsize : 1;
              collected.push({ txid: tx.txid, vsize, feeRate });
            }
          }
          if (!cancelled) {
            setTxData([...collected]);
            setLoadedCount(collected.length);
          }
        }

        // TX 5000개 초과 시: 나머지는 평균 vsize/feeRate로 보간
        if (!cancelled && total > 5000) {
          const avgVsize = collected.reduce((s, t) => s + t.vsize, 0) / collected.length || 140;
          const avgFeeRate = collected.reduce((s, t) => s + t.feeRate, 0) / collected.length || 1;
          for (let i = collected.length; i < total; i++) {
            collected.push({
              txid: txids[i] || `interp-${i}`,
              vsize: avgVsize * (0.5 + Math.random()),
              feeRate: avgFeeRate * (0.5 + Math.random()),
            });
          }
          setTxData([...collected]);
        }

        if (!cancelled) setLoading(false);
      })();
    }

    return () => { cancelled = true; };
  }, [total, blockHash, sourceType]);

  // Canvas 렌더링 — squarify 레이아웃
  useEffect(() => {
    if (!txData.length) return;

    const render = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const w = container.offsetWidth;
      const h = container.offsetHeight;
      if (w === 0 || h === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // fee rate 내림차순 정렬 후 squarify
      const items = txData.map(tx => ({ ...tx, weight: tx.vsize }));
      items.sort((a, b) => b.feeRate - a.feeRate);
      const rects = squarify(items, w, h);
      rectsRef.current = rects;

      ctx.clearRect(0, 0, w, h);

      for (const rect of rects) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = feeColor(rect.feeRate);
        ctx.fillRect(rect.x, rect.y, rect.w - 0.5, rect.h - 0.5);

        // 선택된 TX 하이라이트
        if (rect.txid === selectedTxid) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2.5, rect.h - 2.5);
        }
      }

      ctx.globalAlpha = 1;
    };

    const rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [txData, selectedTxid]);

  if (!total) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted text-label">
        TX 데이터 없음
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-muted text-label-xs z-10 pointer-events-none">
          {loadedCount > 0
            ? `${loadedCount.toLocaleString()} / ${total.toLocaleString()} TX 로딩 중…`
            : `${total.toLocaleString()}개 TX 로딩 중…`
          }
        </div>
      )}
      <canvas ref={canvasRef} className="block cursor-pointer" onClick={handleCanvasClick}
              role="img" aria-label="블록 내 트랜잭션 분포를 트리맵으로 시각화. 각 셀은 TX를 나타내며 색상은 수수료율입니다." />
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
      <div className="text-muted text-sm mb-1">수수료 분포 (sat/vB)</div>
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
      <div className="flex justify-between text-text-dim text-sm mt-0.5">
        <span>min: {Math.round(min)}</span>
        <span>mid: {Math.round(med)}</span>
        <span>max: {Math.round(max)}</span>
      </div>
    </div>
  );
}

// TX 목록 (fee, size, in/out 정보 포함)
function TxListEnriched({ visibleTxids, txDetails, setTxDetails, sourceType, onTxClick, txLoading, hasMore, txids, onLoadMore, highlightTxid, setTxPage }) {
  // 표시 중인 TX의 상세 정보를 lazy-fetch
  useEffect(() => {
    const toFetch = visibleTxids.filter(txid => !txDetails[txid]);
    if (toFetch.length === 0) return;

    const batchSize = 10;
    let cancelled = false;

    (async () => {
      for (let i = 0; i < toFetch.length && !cancelled; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(txid => {
          const url = sourceType === 'server' ? `/api/tx/${txid}` : `https://mempool.space/api/tx/${txid}`;
          return fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
        }));

        if (cancelled) return;
        const updates = {};
        batch.forEach((txid, idx) => {
          if (results[idx]) {
            updates[txid] = sourceType === 'server' ? normalizeRpcTx(results[idx]) : results[idx];
          }
        });
        if (Object.keys(updates).length > 0) {
          setTxDetails(prev => ({ ...prev, ...updates }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [visibleTxids.length, sourceType]);

  // 하이라이트 TX가 현재 페이지에 없으면 페이지 확장 후 스크롤
  useEffect(() => {
    if (!highlightTxid) return;
    const idx = txids.indexOf(highlightTxid);
    if (idx === -1) return;
    const neededPage = Math.ceil((idx + 1) / 25);
    const currentMaxPage = Math.ceil(visibleTxids.length / 25);
    if (neededPage > currentMaxPage) setTxPage?.(neededPage);
    setTimeout(() => {
      const el = document.getElementById(`tx-row-${highlightTxid}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [highlightTxid]);

  return (
    <div className="px-2 pb-2 flex-1 overflow-y-auto min-h-0">
      {txLoading && (
        <div className="text-text-dim text-xs py-2 text-center">TX 목록 로딩 중…</div>
      )}
      {/* 헤더 행 */}
      <div className="grid grid-cols-[36px_1fr_64px_80px_56px_56px_48px] gap-1 items-center text-label-xs text-muted py-1 border-b border-white/10 mb-0.5">
        <span>#</span>
        <span>TXID</span>
        <span className="text-right">s/vB</span>
        <span className="text-right">BTC</span>
        <span className="text-right">Weight</span>
        <span className="text-right">In/Out</span>
        <span className="text-right">Type</span>
      </div>
      {visibleTxids.map((txid, i) => {
        const tx = txDetails[txid];
        const feeRate = tx?.fee != null && tx?.weight ? (tx.fee / (tx.weight / 4)).toFixed(1) : null;
        const vinCount = tx?.vin?.length;
        const voutCount = tx?.vout?.length;
        // 총 출력 금액
        const totalOut = tx?.vout?.reduce((s, v) => s + (v.value || 0), 0);
        const valueBtc = totalOut != null ? (totalOut / 1e8).toFixed(4) : null;
        // Weight
        const weightStr = tx?.weight ? tx.weight.toLocaleString() : '…';
        // TX 유형 판별
        let txType = '…';
        if (tx) {
          const hasTaproot = tx.vin?.some(v => v.prevout?.scriptpubkey_type === 'v1_p2tr') ||
                            tx.vout?.some(v => v.scriptpubkey_type === 'v1_p2tr');
          const hasWitness = tx.vin?.some(v => v.witness?.length > 0);
          if (hasTaproot) txType = 'TR';
          else if (hasWitness) txType = 'SW';
          else txType = 'Leg';
        }

        const isHighlighted = txid === highlightTxid;
        return (
          <div
            key={txid}
            id={`tx-row-${txid}`}
            onClick={(e) => { e.stopPropagation(); onTxClick?.({ txid, data: tx || {} }); }}
            className={`grid grid-cols-[36px_1fr_64px_80px_56px_56px_48px] gap-1 items-center text-xs py-1.5 px-1
                       border-b border-dark-surface cursor-pointer hover:bg-btc-orange/5 rounded
                       ${isHighlighted ? 'bg-btc-orange/15 border-l-2 border-l-btc-orange' : ''}`}
          >
            <span className={`text-text-dim ${i === 0 ? 'text-btc-orange font-bold' : ''}`}>
              {i === 0 ? 'CB' : i}
            </span>
            <span className="font-mono truncate text-text-secondary">{txid}</span>
            <span className="text-right font-mono" style={{ color: feeRate ? feeColor(parseFloat(feeRate)) : undefined }}>
              {feeRate ?? '—'}
            </span>
            <span className="text-right text-text-dim font-mono">{valueBtc ?? '…'}</span>
            <span className="text-right text-text-dim">{weightStr}</span>
            <span className="text-right text-muted">
              {vinCount != null && voutCount != null ? `${vinCount}→${voutCount}` : '…'}
            </span>
            <span className={`text-right ${txType === 'TR' ? 'text-block-purple' : txType === 'SW' ? 'text-tx-blue' : 'text-btc-orange'}`}>
              {txType}
            </span>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="w-full text-center text-btc-orange text-xs py-2 cursor-pointer
                    bg-transparent border border-white/10 rounded mt-1.5
                    hover:bg-white/5"
        >
          더 보기 ({(txids.length - visibleTxids.length).toLocaleString()}개 남음)
        </button>
      )}
    </div>
  );
}

// 정보 행
function InfoRow({ label, value, mono, highlight, copyable }) {
  return (
    <div className="flex justify-between py-1.5 gap-3 min-w-0">
      <span className="text-muted shrink-0 text-sm">{label}</span>
      <span className={`text-right text-sm flex items-center gap-1 min-w-0
                       ${highlight ? 'text-btc-orange font-bold' : 'text-text-primary'}
                       ${mono ? 'font-mono text-xs' : ''}`}>
        {mono
          ? <span className="break-all min-w-0 select-all" title={value}>{value ?? '—'}</span>
          : (value ?? '—')
        }
        {copyable && value && <CopyButton text={value} />}
      </span>
    </div>
  );
}

export default function BlockDetailPanel({ block, mempoolBlocks, onClose, onTxClick, sourceType, onAddressClick, sidebarWidth = 0 }) {
  const isPending = block?.isPending === true;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [txids, setTxids] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showTxList, setShowTxList] = useState(true);
  const [txPage, setTxPage] = useState(1);
  // TX 상세 캐시 (lazy fetch)
  const [txDetails, setTxDetails] = useState({});
  // 트리맵 셀 선택 → TX 목록 하이라이트
  const [selectedTreemapTxid, setSelectedTreemapTxid] = useState(null);

  // 현재 블록 height 추적 (prev/next 네비게이션)
  const [navHeight, setNavHeight] = useState(block?.height ?? null);
  const [navHash, setNavHash] = useState(block?.hash ?? null);

  useEffect(() => {
    if (isPending) { setLoading(false); return; }
    const hash = navHash || block?.hash;
    if (!hash) return;
    setLoading(true);
    setError(null);
    setShowTxList(true);
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

  // pending 모드: mempoolBlocks[0] 실시간 추적
  const pendingBlock = isPending ? (mempoolBlocks?.[0] ?? block?.mempoolBlock) : null;
  const pendingFeeRange = pendingBlock?.feeRange;
  const pendingMedianFee = pendingBlock?.medianFee ?? pendingFeeRange?.[3];
  const pendingNTx = pendingBlock?.nTx;
  const pendingVSize = pendingBlock?.blockVSize;
  const pendingTotalFees = pendingBlock?.totalFees;

  return (
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden bg-panel-bg-solid
                      font-mono text-sm text-text-primary z-[var(--z-modal)]
                      px-5 py-4 flex flex-col border-r border-white/10">

        {/* 1. Header */}
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            {!isPending && (
              <button
                onClick={() => navigateBlock(-1)}
                className="bg-transparent border border-white/10 rounded text-muted
                          cursor-pointer px-2 py-0.5 text-sm hover:text-text-primary hover:bg-white/5"
              >
                ‹
              </button>
            )}
            <div>
              {isPending ? (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-mempool-green animate-pulse" />
                  <span className="text-mempool-green font-bold text-base">Next Block (대기 중)</span>
                </div>
              ) : (
                <>
                  <div className="text-btc-orange font-bold text-base">
                    Block #{(navHeight ?? block?.height)?.toLocaleString() ?? '?'}
                  </div>
                  {pool && (
                    <div className="text-muted text-xs mt-0.5">Mined by {pool}</div>
                  )}
                </>
              )}
            </div>
            {!isPending && (
              <button
                onClick={() => navigateBlock(1)}
                className="bg-transparent border border-white/10 rounded text-muted
                          cursor-pointer px-2 py-0.5 text-sm hover:text-text-primary hover:bg-white/5"
              >
                ›
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border border-white/10 rounded text-muted
                      cursor-pointer px-2 py-0.5 text-sm hover:text-text-primary hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {/* Pending 모드 */}
        {isPending && (
          <>
            {/* Treemap(좌) + Pending 정보(우) 사이드바이사이드 */}
            <div className="flex gap-3 mb-3 max-sm:flex-col">
              {/* 좌측 — TX FEE RATE MAP (정사각형, 실시간 진동) */}
              <div className="w-[40%] shrink-0 min-w-0 bg-dark-surface/60 border border-mempool-green/20 rounded-lg p-2">
                <div className="text-label text-muted font-bold mb-1">TX FEE RATE MAP (실시간)</div>
                <div className="h-[420px] max-sm:h-[300px]">
                  <PendingBlockTreemap mempoolBlock={pendingBlock} />
                </div>
                {/* Fee 색상 범례 */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {FEE_LEGEND.map(l => (
                    <div key={l.label} className="flex items-center gap-0.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                      <span className="text-label-xs text-muted">{l.label}</span>
                    </div>
                  ))}
                  <span className="text-label-xs text-muted ml-1">sat/vB</span>
                </div>
              </div>

              {/* 우측 — Pending 블록 정보 */}
              <div className="flex-1 max-sm:w-full space-y-3 min-w-0 overflow-hidden pr-8">
                <div className="space-y-0.5">
                  {pendingNTx != null && <InfoRow label="TX Count" value={`~${pendingNTx.toLocaleString()}`} />}
                  {pendingVSize != null && <InfoRow label="Block vSize" value={`${(pendingVSize / 1_000_000).toFixed(3)} MvB`} />}
                  {pendingTotalFees != null && <InfoRow label="Total Fees" value={`${formatBtc(pendingTotalFees)} BTC`} highlight />}
                  {pendingMedianFee != null && <InfoRow label="Median Fee" value={`${Math.round(pendingMedianFee)} sat/vB`} />}
                </div>
                {pendingFeeRange && (
                  <div className="p-2 bg-dark-surface rounded border border-dark-border">
                    <FeeBar feeRange={pendingFeeRange} />
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-text-dim text-xs py-2">
              채굴 시 자동으로 확정 블록 정보로 전환됩니다
            </div>
          </>
        )}

        {/* 확정 블록 모드 */}
        {!isPending && (
          <>
            {loading && (
              <div className="text-text-dim text-center py-4">로드 중…</div>
            )}

            {error && (
              <div className="text-error text-center py-2 text-xs">로드 실패: {error}</div>
            )}

            {detail && (
              <>
                {/* 2. Treemap(좌) + 블록 정보(우) 사이드바이사이드 */}
                <div className="flex gap-3 mb-3 max-sm:flex-col overflow-hidden">
                  {/* 좌측 — TX FEE RATE MAP (정사각형) */}
                  <div className="w-[40%] shrink-0 min-w-0 bg-dark-surface/60 border border-dark-border rounded-lg p-2">
                    <div className="text-label text-muted font-bold mb-1">TX FEE RATE MAP</div>
                    <div className="h-[420px] max-sm:h-[300px]">
                      <BlockTreemap
                        txids={txids.length > 0 ? txids : (detail._txids || [])}
                        blockHash={navHash || block?.hash}
                        sourceType={sourceType}
                        selectedTxid={selectedTreemapTxid}
                        onCellClick={setSelectedTreemapTxid}
                      />
                    </div>
                    {/* Fee 색상 범례 */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {FEE_LEGEND.map(l => (
                        <div key={l.label} className="flex items-center gap-0.5">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                          <span className="text-label-xs text-muted">{l.label}</span>
                        </div>
                      ))}
                      <span className="text-label-xs text-muted ml-1">sat/vB</span>
                    </div>
                  </div>

                  {/* 우측 — 블록 정보 + 통계 */}
                  <div className="flex-1 max-sm:w-full space-y-3 min-w-0 overflow-hidden pr-8">
                    {/* 블록 메타정보 */}
                    <div className="space-y-0.5">
                      <InfoRow label="Hash" value={detail.id || block?.hash} mono copyable />
                      {ts && <InfoRow label="Timestamp" value={`${ts} (${relativeTime(detail.timestamp)})`} />}
                      <InfoRow label="TX Count" value={txCount?.toLocaleString()} />
                      {sizeKB && <InfoRow label="Size" value={sizeKB} />}
                      {weightMWU && <InfoRow label="Weight" value={weightMWU} />}
                      {feeRange && (
                        <InfoRow label="Fee Span" value={`${Math.round(feeRange[0])} – ${Math.round(feeRange[feeRange.length - 1])} sat/vB`} />
                      )}
                      {medianFee != null && (
                        <InfoRow label="Median Fee" value={`${medianFee.toFixed(1)} sat/vB`} />
                      )}
                      {totalFees != null && (
                        <InfoRow label="Total Fees" value={`${formatBtc(totalFees)} BTC`} highlight />
                      )}
                      <InfoRow label="Subsidy" value={`${formatBtc(subsidy)} BTC`} />
                      {rewardSats != null && (
                        <InfoRow label="Subsidy + Fees" value={`${formatBtc(rewardSats)} BTC`} highlight />
                      )}
                    </div>
                    {/* TX 유형 분포 */}
                    <TxTypeBar
                      txTypeStats={detail.txTypeStats}
                      txids={txids}
                      blockHash={navHash || block?.hash}
                      sourceType={sourceType}
                    />
                    {feeRange && (
                      <div className="p-2 bg-dark-surface rounded border border-dark-border">
                        <FeeBar feeRange={feeRange} />
                      </div>
                    )}

                    {/* 4. Details (상시 표시) */}
                    <div className="space-y-0.5 text-xs">
                      <InfoRow label="Difficulty" value={detail.difficulty?.toLocaleString()} />
                      <InfoRow label="Nonce" value={detail.nonce?.toLocaleString()} />
                      <InfoRow label="Bits" value={detail.bits} />
                      <InfoRow label="Version" value={detail.version != null ? `0x${detail.version.toString(16)}` : null} />
                      <InfoRow label="Merkle Root" value={detail.merkle_root} mono copyable />
                      <InfoRow label="Previous Block" value={detail.previousblockhash} mono copyable />
                    </div>

                    {/* mempool.space 링크 */}
                    <div className="text-left">
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

                    {/* 블록 통계 (서버 집계) */}
                    {detail.blockStats && (
                      <div className="p-2 bg-dark-surface rounded border border-dark-border space-y-0.5">
                        <div className="text-muted text-label-sm font-bold mb-1">BLOCK STATISTICS</div>
                        <InfoRow label="총 수수료" value={detail.blockStats.totalFees != null ? `${formatBtc(detail.blockStats.totalFees)} BTC` : null} highlight />
                        <InfoRow label="평균 Fee Rate" value={detail.blockStats.avgFeeRate != null ? `${detail.blockStats.avgFeeRate} sat/vB` : null} />
                        <InfoRow label="중간 Fee Rate" value={detail.blockStats.medianFeeRate != null ? `${detail.blockStats.medianFeeRate} sat/vB` : null} />
                        <InfoRow label="최대 TX 출력" value={detail.blockStats.maxTxValue != null ? `${formatBtc(detail.blockStats.maxTxValue)} BTC` : null} />
                        <InfoRow label="평균 TX 크기" value={detail.blockStats.avgTxSize != null ? `${detail.blockStats.avgTxSize} B` : null} />
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. TX 목록 — 전체 너비, 남은 공간 채움 */}
                {txCount > 0 && (
                  <div className="flex-1 flex flex-col bg-dark-surface/40 rounded border border-dark-border min-h-0">
                    <div
                      onClick={loadTxids}
                      className="px-2 py-1.5 text-sm font-bold text-btc-orange cursor-pointer
                                 select-none hover:text-btc-orange/80 transition-colors shrink-0"
                    >
                      {showTxList ? '▾' : '▸'} TRANSACTIONS ({txCount?.toLocaleString()})
                    </div>

                    {showTxList && (
                      <TxListEnriched
                        visibleTxids={visibleTxids}
                        txDetails={txDetails}
                        setTxDetails={setTxDetails}
                        sourceType={sourceType}
                        onTxClick={onTxClick}
                        txLoading={txLoading}
                        hasMore={hasMore}
                        txids={txids}
                        onLoadMore={() => setTxPage(p => p + 1)}
                        highlightTxid={selectedTreemapTxid}
                        setTxPage={setTxPage}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
  );
}
