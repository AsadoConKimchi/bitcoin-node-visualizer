import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { relativeTime } from '../utils/format.jsx';

const MEMPOOL_BASE = 'https://mempool.space/api';
const BULK_BATCH = 10;
const LOAD_COUNT = 20;
const CACHE_MAX = 300;
const DEBOUNCE_MS = 300;

// ── Bulk fetch ──────────────────────────────────────────────────────────────
async function fetchBlockRange(minHeight, maxHeight, sourceType) {
  if (minHeight < 0) minHeight = 0;
  if (maxHeight < minHeight) return [];

  const batches = [];
  for (let h = minHeight; h <= maxHeight; h += BULK_BATCH) {
    const batchEnd = Math.min(h + BULK_BATCH - 1, maxHeight);
    const url = sourceType === 'server'
      ? `/api/blocks-bulk/${h}/${batchEnd}`
      : `${MEMPOOL_BASE}/v1/blocks-bulk/${h}/${batchEnd}`;
    batches.push(fetch(url).then(r => r.ok ? r.json() : []).catch(() => []));
  }
  const results = await Promise.all(batches);
  return results.flat().map(b => ({
    height: b.height,
    hash: b.id ?? b.hash,
    txCount: b.tx_count ?? b.nTx,
    pool: b.extras?.pool?.name ?? null,
    timestamp: b.timestamp ?? b.time,
  })).sort((a, b) => a.height - b.height);
}

// ── BlockCard ────────────────────────────────────────────────────────────────
function BlockCard({ block, isLatest, highlight, onClick, onReplay, cardRef }) {
  return (
    <div
      ref={cardRef}
      onClick={() => onClick?.(block)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(block); }}
      tabIndex={0}
      role="button"
      title="클릭하면 블록 상세 정보"
      className={`shrink-0 rounded-lg cursor-pointer focus-ring
                 transition-all duration-300 px-3 py-2
                 ${isLatest
                   ? 'w-[150px] border-2 border-btc-orange/40 bg-btc-orange/8'
                   : 'w-[130px] border border-dark-border bg-white/4 hover:bg-white/6'
                 }
                 ${highlight ? 'ring-2 ring-btc-orange animate-pulse' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-bold text-sm font-mono ${isLatest ? 'text-btc-orange' : 'text-text-primary'}`}>
          {block.height != null ? `#${block.height.toLocaleString()}` : '?'}
        </span>
        {isLatest && onReplay && (
          <button
            onClick={(e) => { e.stopPropagation(); onReplay(); }}
            className="text-tx-blue hover:text-tx-blue/80 text-label cursor-pointer
                       hover:bg-tx-blue/10 rounded px-1 focus-ring"
            title="Compact Block Relay 재생"
          >
            ▶
          </button>
        )}
      </div>
      <div className="mt-1 space-y-0.5">
        {block.txCount != null && (
          <div className="text-muted text-label font-mono">{block.txCount.toLocaleString()} TX</div>
        )}
        {block.pool && (
          <div className="text-text-dim text-label-sm truncate">{block.pool}</div>
        )}
        {block.timestamp && (
          <div className="text-text-dim text-label-sm">{relativeTime(block.timestamp)}</div>
        )}
      </div>
    </div>
  );
}

// ── PendingCard ──────────────────────────────────────────────────────────────
function PendingCard({ mempoolBlock, onClick }) {
  if (!mempoolBlock) return null;
  const medianFee = mempoolBlock.medianFee ?? mempoolBlock.feeRange?.[3];

  return (
    <div
      onClick={() => onClick?.({ isPending: true, mempoolBlock })}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.({ isPending: true, mempoolBlock }); }}
      tabIndex={0}
      role="button"
      title="클릭하면 대기 중인 블록 상세 정보"
      className="shrink-0 w-[130px] border border-dashed border-mempool-green/40 rounded-lg
                 cursor-pointer px-3 py-2 bg-mempool-green/5 hover:bg-mempool-green/10
                 transition-all duration-300 animate-pulse-subtle"
    >
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-mempool-green animate-pulse" />
        <span className="font-bold text-sm text-mempool-green">Next</span>
      </div>
      <div className="mt-1 space-y-0.5">
        <div className="text-muted text-label font-mono">{mempoolBlock.nTx?.toLocaleString()} TX</div>
        {medianFee != null && (
          <div className="text-text-dim text-label-sm">{Math.round(medianFee)} sat/vB</div>
        )}
      </div>
    </div>
  );
}

// ── Connector ────────────────────────────────────────────────────────────────
function Connector() {
  return (
    <div className="shrink-0 flex items-center">
      <div className="w-4 h-[2px] bg-white/10" />
    </div>
  );
}

// ── ChainStrip ───────────────────────────────────────────────────────────────
const ChainStrip = forwardRef(function ChainStrip({
  recentBlocks, mempoolBlocks, onBlockClick, onReplayCompactBlock, sourceType, visible,
}, ref) {
  const scrollRef = useRef(null);
  const [blockCache, setBlockCache] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [reachedGenesis, setReachedGenesis] = useState(false);
  const [viewMode, setViewMode] = useState('tip'); // 'tip' | 'jumped'
  const [jumpedHeight, setJumpedHeight] = useState(null);
  const [highlightHeight, setHighlightHeight] = useState(null);
  const highlightTimerRef = useRef(null);
  const debounceRef = useRef(null);
  const preloadedRef = useRef(false);
  const cardRefsMap = useRef(new Map());

  // recentBlocks 정규화 (최신 10개, 높이순)
  const blocks = [...(recentBlocks || [])]
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0))
    .slice(-10);

  const latestHeight = blocks[blocks.length - 1]?.height;

  // blockCache → 정렬된 배열 (recentBlocks 높이 제외)
  const recentHeights = new Set(blocks.map(b => b.height));
  const cachedBlocks = Array.from(blockCache.values())
    .filter(b => !recentHeights.has(b.height))
    .sort((a, b) => a.height - b.height);

  // 전체 블록 목록
  const allBlocks = [...cachedBlocks, ...blocks]
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));

  // 캐시 eviction (CACHE_MAX 초과 시 뷰포트 중심에서 가장 먼 블록 제거)
  useEffect(() => {
    if (blockCache.size <= CACHE_MAX) return;
    setBlockCache(prev => {
      const next = new Map(prev);
      // recentBlocks 높이 보호
      const protected_ = new Set(blocks.map(b => b.height));
      const entries = Array.from(next.entries())
        .filter(([h]) => !protected_.has(h));

      // 뷰포트 중심 높이 추정
      const centerHeight = jumpedHeight ?? latestHeight ?? 0;
      entries.sort((a, b) => Math.abs(b[0] - centerHeight) - Math.abs(a[0] - centerHeight));

      const toRemove = entries.slice(0, next.size - CACHE_MAX);
      for (const [h] of toRemove) next.delete(h);
      return next;
    });
  }, [blockCache.size]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bulk load older blocks ──
  const loadOlderBlocks = useCallback(async () => {
    if (loading || reachedGenesis) return;

    const lowestHeight = allBlocks.length > 0 ? allBlocks[0].height : (latestHeight ?? 0);
    if (lowestHeight <= 0) {
      setReachedGenesis(true);
      return;
    }

    const targetMin = Math.max(0, lowestHeight - LOAD_COUNT);
    const targetMax = lowestHeight - 1;
    if (targetMax < 0) { setReachedGenesis(true); return; }

    setLoading(true);
    try {
      const fetched = await fetchBlockRange(targetMin, targetMax, sourceType);
      if (fetched.length > 0) {
        setBlockCache(prev => {
          const next = new Map(prev);
          for (const b of fetched) next.set(b.height, b);
          return next;
        });
      }
      if (targetMin === 0) setReachedGenesis(true);
    } catch (err) {
      console.warn('[ChainStrip] 이전 블록 로드 실패:', err);
    }
    setLoading(false);
  }, [loading, reachedGenesis, allBlocks, latestHeight, sourceType]);

  // 스크롤 좌측 끝 감지 (디바운스)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollLeft < 200) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadOlderBlocks(), DEBOUNCE_MS);
    }
  }, [loadOlderBlocks]);

  // 초기 프리로드
  useEffect(() => {
    if (preloadedRef.current || !blocks.length) return;
    preloadedRef.current = true;
    loadOlderBlocks();
  }, [blocks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 캐시 블록 추가 시 scroll 위치 보정
  const prevCachedCountRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const currentCount = cachedBlocks.length;
    const added = currentCount - prevCachedCountRef.current;
    if (added > 0 && prevCachedCountRef.current > 0 && viewMode === 'tip') {
      el.scrollLeft += added * 148;
    }
    prevCachedCountRef.current = currentCount;
  }, [cachedBlocks.length, viewMode]);

  // 새 블록 도착 시 우측으로 스크롤 (tip 모드)
  const prevBlockCountRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const newCount = recentBlocks?.length ?? 0;
    if (prevBlockCountRef.current === 0) {
      requestAnimationFrame(() => { el.scrollLeft = el.scrollWidth; });
    } else if (newCount > prevBlockCountRef.current && viewMode === 'tip') {
      el.scrollLeft = el.scrollWidth;
    }
    prevBlockCountRef.current = newCount;
  }, [recentBlocks?.length, viewMode]);

  // 트랙패드 wheel 이벤트 → 가로 스크롤 변환 + 브라우저 네비게이션 차단
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        e.preventDefault();
        el.scrollLeft += delta;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── scrollToHeight (imperative) ──
  useImperativeHandle(ref, () => ({
    scrollToHeight: async (height) => {
      // 점프 대상 근처가 아니면 캐시 클리어
      const min = Math.max(0, height - 15);
      const max = height + 15;

      setViewMode('jumped');
      setJumpedHeight(height);
      setReachedGenesis(min === 0);
      setLoading(true);

      try {
        const fetched = await fetchBlockRange(min, max, sourceType);
        setBlockCache(() => {
          const next = new Map();
          for (const b of fetched) next.set(b.height, b);
          return next;
        });
      } catch (err) {
        console.warn('[ChainStrip] 점프 로드 실패:', err);
      }
      setLoading(false);

      // 하이라이트
      setHighlightHeight(height);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightHeight(null), 3000);

      // 렌더 후 스크롤
      requestAnimationFrame(() => {
        const cardEl = cardRefsMap.current.get(height);
        if (cardEl) {
          cardEl.scrollIntoView({ inline: 'center', behavior: 'smooth' });
        }
      });
    },
  }), [sourceType]);

  // "최신으로 돌아가기" 클릭
  const handleBackToTip = useCallback(() => {
    setBlockCache(new Map());
    setViewMode('tip');
    setJumpedHeight(null);
    setHighlightHeight(null);
    setReachedGenesis(false);
    preloadedRef.current = false;
    prevCachedCountRef.current = 0;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollLeft = el.scrollWidth;
    });
  }, []);

  if (!visible || !recentBlocks?.length) return null;

  return (
    <div className="absolute top-[48px] left-0 right-0 z-[var(--z-strip)]
                    bg-dark-bg/80 backdrop-blur-sm border-b border-dark-border">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex items-center gap-0 px-3 py-2 overflow-x-auto
                   scrollbar-thin"
        style={{ scrollBehavior: 'smooth', overscrollBehaviorX: 'contain' }}
      >
        {/* 로딩 인디케이터 */}
        {loading && (
          <div className="shrink-0 text-label text-text-dim px-2">⟳</div>
        )}
        {reachedGenesis && (
          <div className="shrink-0 text-label text-btc-orange px-2">⬡ Genesis</div>
        )}

        {allBlocks.map((block, i) => (
          <React.Fragment key={block.hash || block.height}>
            {i > 0 && <Connector />}
            <BlockCard
              block={block}
              isLatest={block.height === latestHeight}
              highlight={block.height === highlightHeight}
              onClick={onBlockClick}
              onReplay={block.height === latestHeight ? onReplayCompactBlock : null}
              cardRef={(el) => {
                if (el) cardRefsMap.current.set(block.height, el);
                else cardRefsMap.current.delete(block.height);
              }}
            />
          </React.Fragment>
        ))}

        {/* tip 모드에서만 PendingCard 표시 */}
        {viewMode === 'tip' && (
          <>
            <Connector />
            <PendingCard mempoolBlock={mempoolBlocks?.[0]} onClick={onBlockClick} />
          </>
        )}
      </div>

      {/* "최신으로 돌아가기" 버튼 */}
      {viewMode === 'jumped' && latestHeight != null && (
        <button
          onClick={handleBackToTip}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10
                     bg-btc-orange/90 hover:bg-btc-orange text-dark-bg
                     text-xs font-bold px-3 py-1.5 rounded-full
                     cursor-pointer transition-colors shadow-lg"
        >
          ↗ Latest #{latestHeight.toLocaleString()}
        </button>
      )}
    </div>
  );
});

export default ChainStrip;
