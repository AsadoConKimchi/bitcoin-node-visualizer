import React, { useState, useRef, useCallback, useEffect } from 'react';
import MacWindow from './MacWindow.jsx';

const REST_BASE = 'https://mempool.space/api';
const LOAD_BATCH = 10;

function BlockCell({ block, isLatest, onClick, onReplay }) {
  return (
    <div
      onClick={() => onClick?.(block)}
      title="클릭하면 블록 상세 정보"
      className={`rounded-lg relative cursor-pointer
                 transition-all duration-300 px-4 py-2.5
                 ${isLatest
                   ? 'border-l-2 border-l-btc-orange/60 border border-white/8 bg-btc-orange/5'
                   : 'border border-white/8 bg-white/5'
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
      <div className="flex items-center gap-1.5 mt-0.5">
        {block.txCount != null && (
          <span className="text-muted text-[11px] font-mono">{block.txCount.toLocaleString()} TX</span>
        )}
        {block.pool && (
          <span className="text-text-dim text-[11px]">· {block.pool}</span>
        )}
      </div>
    </div>
  );
}

function PendingCell() {
  return (
    <div className="border border-dashed border-white/8 rounded-lg
                   px-4 py-2.5 text-center">
      <div className="text-muted-dim text-sm">?</div>
      <div className="text-[11px] text-muted-dim">pending</div>
    </div>
  );
}

export default function ChainStrip({
  recentBlocks, onBlockClick, onReplayCompactBlock,
  minimized, onClose, onMinimize, zIndex, onFocus,
  hudHeight, sourceType,
}) {
  if (!recentBlocks?.length) return null;

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
  const topY = (hudHeight || 56) + 16;

  // 이전 블록 로드 (위로 스크롤 시)
  const loadOlderBlocks = useCallback(async () => {
    if (loading || reachedGenesis) return;

    const oldest = allBlocks[0];
    if (!oldest?.hash && oldest?.height == null) return;

    setLoading(true);
    try {
      let currentHash = oldest.hash;

      // hash가 없으면 height로 hash 조회
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
          // 제네시스 도달
          setReachedGenesis(true);
          break;
        }

        // 이전 블록 데이터 가져오기
        const prevRes = await fetch(`${REST_BASE}/block/${prevHash}`);
        if (!prevRes.ok) break;
        const prevBlock = await prevRes.json();

        fetched.unshift({
          height: prevBlock.height,
          hash: prevHash,
          txCount: prevBlock.tx_count,
          pool: prevBlock.extras?.pool?.name,
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

  // 스크롤 상단 도달 감지
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 40) {
      loadOlderBlocks();
    }
  }, [loadOlderBlocks]);

  // 최초 렌더 시 스크롤을 하단으로
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [recentBlocks.length]);

  return (
    <MacWindow
      title="CHAIN"
      titleColor="text-text-primary"
      initialPosition={{ x: 16, y: topY }}
      onClose={onClose}
      onMinimize={onMinimize}
      minimized={minimized}
      zIndex={zIndex}
      onFocus={onFocus}
      width={200}
      height={380}
      headerRight={
        <span className="text-muted text-[11px] ml-auto font-mono">
          #{latestHeight?.toLocaleString() ?? '?'}
        </span>
      }
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="px-3 py-2 flex flex-col gap-1.5 overflow-y-auto flex-1"
      >
        {/* 로딩 인디케이터 */}
        {loading && (
          <div className="text-center text-[11px] text-text-dim py-1">⟳ 로딩 중...</div>
        )}
        {reachedGenesis && (
          <div className="text-center text-[11px] text-btc-orange py-1">⬡ Genesis Block</div>
        )}

        {allBlocks.map((block) => (
          <BlockCell
            key={block.hash || block.height}
            block={block}
            isLatest={block.height === latestHeight}
            onClick={onBlockClick}
            onReplay={block.height === latestHeight ? onReplayCompactBlock : null}
          />
        ))}
        <PendingCell />
      </div>
    </MacWindow>
  );
}
