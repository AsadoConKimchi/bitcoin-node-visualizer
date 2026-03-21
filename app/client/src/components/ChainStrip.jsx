import React, { useState, useRef, useCallback, useEffect } from 'react';
import { relativeTime } from '../utils/format.jsx';

const REST_BASE = 'https://mempool.space/api';
const LOAD_BATCH = 10;

function BlockCard({ block, isLatest, onClick, onReplay }) {
  return (
    <div
      onClick={() => onClick?.(block)}
      title="클릭하면 블록 상세 정보"
      className={`shrink-0 rounded-lg cursor-pointer
                 transition-all duration-300 px-3 py-2
                 ${isLatest
                   ? 'w-[150px] border-2 border-btc-orange/40 bg-btc-orange/8'
                   : 'w-[130px] border border-white/8 bg-white/4 hover:bg-white/6'
                 }`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-bold text-sm font-mono ${isLatest ? 'text-btc-orange' : 'text-text-primary'}`}>
          {block.height != null ? `#${block.height.toLocaleString()}` : '?'}
        </span>
        {isLatest && onReplay && (
          <button
            onClick={(e) => { e.stopPropagation(); onReplay(); }}
            className="text-tx-blue hover:text-tx-blue/80 text-[11px] cursor-pointer
                       hover:bg-tx-blue/10 rounded px-1"
            title="Compact Block Relay 재생"
          >
            ▶
          </button>
        )}
      </div>
      <div className="mt-1 space-y-0.5">
        {block.txCount != null && (
          <div className="text-muted text-[11px] font-mono">{block.txCount.toLocaleString()} TX</div>
        )}
        {block.pool && (
          <div className="text-text-dim text-[10px] truncate">{block.pool}</div>
        )}
        {block.timestamp && (
          <div className="text-text-dim text-[10px]">{relativeTime(block.timestamp)}</div>
        )}
      </div>
    </div>
  );
}

function PendingCard() {
  return (
    <div className="shrink-0 w-[100px] border border-dashed border-white/8 rounded-lg
                   px-3 py-2 text-center flex flex-col items-center justify-center">
      <div className="text-muted-dim text-sm">?</div>
      <div className="text-[10px] text-muted-dim">pending</div>
    </div>
  );
}

// 블록 간 연결선
function Connector() {
  return (
    <div className="shrink-0 flex items-center">
      <div className="w-4 h-[2px] bg-white/10" />
    </div>
  );
}

export default function ChainStrip({
  recentBlocks, onBlockClick, onReplayCompactBlock, sourceType, visible,
}) {
  if (!visible || !recentBlocks?.length) return null;

  const scrollRef = useRef(null);
  const [olderBlocks, setOlderBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reachedGenesis, setReachedGenesis] = useState(false);

  const blocks = [...recentBlocks]
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0))
    .slice(-5);

  // 전체 블록 목록: 오래된 순 → 최신 순
  const allBlocks = [...olderBlocks, ...blocks]
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));

  const latestHeight = blocks[blocks.length - 1]?.height;

  // 이전 블록 로드 (좌로 스크롤 시)
  const loadOlderBlocks = useCallback(async () => {
    if (loading || reachedGenesis) return;

    const oldest = allBlocks[0];
    if (!oldest?.hash && oldest?.height == null) return;

    setLoading(true);
    try {
      let currentHash = oldest.hash;

      if (!currentHash && oldest.height != null) {
        const hRes = await fetch(`${REST_BASE}/block-height/${oldest.height}`);
        if (hRes.ok) currentHash = await hRes.text();
      }

      if (!currentHash) { setLoading(false); return; }

      const fetched = [];
      for (let i = 0; i < LOAD_BATCH; i++) {
        const res = await fetch(`${REST_BASE}/block/${currentHash}`);
        if (!res.ok) break;
        const blockData = await res.json();

        const prevHash = blockData.previousblockhash;
        if (!prevHash) {
          setReachedGenesis(true);
          break;
        }

        const prevRes = await fetch(`${REST_BASE}/block/${prevHash}`);
        if (!prevRes.ok) break;
        const prevBlock = await prevRes.json();

        fetched.unshift({
          height: prevBlock.height,
          hash: prevHash,
          txCount: prevBlock.tx_count,
          pool: prevBlock.extras?.pool?.name,
          timestamp: prevBlock.timestamp,
        });

        currentHash = prevHash;

        if (prevBlock.height === 0) {
          setReachedGenesis(true);
          break;
        }
      }

      if (fetched.length > 0) {
        setOlderBlocks(prev => {
          const existingHeights = new Set(prev.map(b => b.height));
          const newBlocks = fetched.filter(b => !existingHeights.has(b.height));
          return [...newBlocks, ...prev];
        });
      }
    } catch (err) {
      console.warn('[ChainStrip] 이전 블록 로드 실패:', err);
    }
    setLoading(false);
  }, [loading, reachedGenesis, allBlocks]);

  // 스크롤 좌측 끝 감지
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollLeft < 60) {
      loadOlderBlocks();
    }
  }, [loadOlderBlocks]);

  // 최초 렌더 시 스크롤을 우측(최신)으로
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [recentBlocks.length]);

  return (
    <div className="absolute top-[40px] left-0 right-0 z-[9]
                    bg-dark-bg/80 backdrop-blur-sm border-b border-white/6">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex items-center gap-0 px-3 py-2 overflow-x-auto
                   scrollbar-thin"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* 로딩 인디케이터 */}
        {loading && (
          <div className="shrink-0 text-[11px] text-text-dim px-2">⟳</div>
        )}
        {reachedGenesis && (
          <div className="shrink-0 text-[11px] text-btc-orange px-2">⬡ Genesis</div>
        )}

        {allBlocks.map((block, i) => (
          <React.Fragment key={block.hash || block.height}>
            {i > 0 && <Connector />}
            <BlockCard
              block={block}
              isLatest={block.height === latestHeight}
              onClick={onBlockClick}
              onReplay={block.height === latestHeight ? onReplayCompactBlock : null}
            />
          </React.Fragment>
        ))}
        <Connector />
        <PendingCard />
      </div>
    </div>
  );
}
