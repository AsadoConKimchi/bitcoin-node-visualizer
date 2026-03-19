import React from 'react';

function BlockCell({ block, isLatest, onClick, onReplay }) {
  return (
    <div
      onClick={() => onClick?.(block)}
      title="클릭하면 블록 상세 정보"
      className={`rounded relative cursor-pointer
                 transition-colors duration-150 shrink-0
                 min-w-[90px] px-2.5 py-1.5
                 max-sm:min-w-[72px] max-sm:px-2 max-sm:py-1
                 ${isLatest
                   ? 'border border-btc-orange shadow-[0_0_10px_rgba(247,147,26,0.3)] bg-btc-orange/5'
                   : 'border border-[#1e3a6e] bg-[rgba(14,30,60,0.5)]'
                 }`}
    >
      <div className={`font-bold text-[10px] ${isLatest ? 'text-btc-orange' : 'text-blue-400'}`}>
        {block.height != null ? `#${block.height.toLocaleString()}` : '?'}
      </div>
      {block.hash && (
        <div className="text-muted-dim text-[8px] truncate max-w-[80px]">
          {block.hash.slice(0, 8)}…
        </div>
      )}
      <div className="flex items-center gap-1">
        {block.txCount != null && (
          <span className="text-muted text-[8px]">{block.txCount.toLocaleString()} TX</span>
        )}
        {/* 최신 블록에만 재생 버튼 */}
        {isLatest && onReplay && (
          <button
            onClick={(e) => { e.stopPropagation(); onReplay(); }}
            className="text-blue-400 hover:text-blue-300 text-[10px] cursor-pointer
                       hover:bg-blue-400/10 rounded px-0.5"
            title="Compact Block Relay 재생"
          >
            ▶
          </button>
        )}
      </div>
      {block.pool && (
        <div className="text-muted-dim text-[8px]">{block.pool}</div>
      )}
    </div>
  );
}

function Arrow() {
  return <span className="text-[#1e3a6e] text-sm mx-0.5 shrink-0">→</span>;
}

function NextBlock() {
  return (
    <div className="border border-dashed border-[#1e3a6e] rounded
                   min-w-[64px] px-2.5 py-1.5 text-center text-muted-dim shrink-0">
      <div className="text-[#1e3a6e] text-lg">?</div>
      <div className="text-[10px]">pending</div>
    </div>
  );
}

export default function ChainStrip({ recentBlocks, onBlockClick, onReplayCompactBlock }) {
  if (!recentBlocks?.length) return null;

  const blocks = [...recentBlocks]
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0))
    .slice(-5);

  const latestHeight = blocks[blocks.length - 1]?.height;

  return (
    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1
                   z-10 bg-panel-bg-light border border-[#1e3a6e] rounded-md
                   px-3 py-2 backdrop-blur-sm font-mono text-xs
                   max-w-[calc(100vw-80px)] overflow-x-auto
                   max-sm:max-w-[calc(100vw-16px)] max-sm:px-2 max-sm:py-1.5 max-sm:gap-0.5">
      {blocks.map((block, i) => (
        <React.Fragment key={block.hash || i}>
          {i > 0 && <Arrow />}
          <BlockCell
            block={block}
            isLatest={block.height === latestHeight}
            onClick={onBlockClick}
            onReplay={block.height === latestHeight ? onReplayCompactBlock : null}
          />
        </React.Fragment>
      ))}
      <Arrow />
      <NextBlock />
    </div>
  );
}
