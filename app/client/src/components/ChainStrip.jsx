import React from 'react';

function BlockCell({ block, isLatest, onClick, onReplay }) {
  return (
    <div
      onClick={() => onClick?.(block)}
      title="클릭하면 블록 상세 정보"
      className={`rounded-lg relative cursor-pointer
                 transition-all duration-300 px-3 py-2
                 ${isLatest
                   ? 'border-l-2 border-l-btc-orange border border-white/10 bg-btc-orange/5'
                   : 'border border-white/10 bg-white/5'
                 }`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-bold text-sm font-mono ${isLatest ? 'text-btc-orange' : 'text-text-primary'}`}>
          {block.height != null ? `#${block.height.toLocaleString()}` : '?'}
        </span>
        {isLatest && onReplay && (
          <button
            onClick={(e) => { e.stopPropagation(); onReplay(); }}
            className="text-tx-blue hover:text-tx-blue/80 text-[10px] cursor-pointer
                       hover:bg-tx-blue/10 rounded px-1"
            title="Compact Block Relay 재생"
          >
            ▶
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        {block.txCount != null && (
          <span className="text-muted text-[10px] font-mono">{block.txCount.toLocaleString()} TX</span>
        )}
        {block.pool && (
          <span className="text-text-dim text-[10px]">· {block.pool}</span>
        )}
      </div>
    </div>
  );
}

function PendingCell() {
  return (
    <div className="border border-dashed border-white/15 rounded-lg
                   px-3 py-2 text-center">
      <div className="text-muted-dim text-sm">?</div>
      <div className="text-[10px] text-muted-dim">pending</div>
    </div>
  );
}

export default function ChainStrip({ recentBlocks, onBlockClick, onReplayCompactBlock, topOffset, minimized, onClose, onMinimize, onExpand }) {
  if (!recentBlocks?.length) return null;

  // 오름차순 정렬 (작은 번호 위, 큰 번호 아래)
  const blocks = [...recentBlocks]
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0))
    .slice(-5);

  const latestHeight = blocks[blocks.length - 1]?.height;

  const topStyle = topOffset > 0 ? { top: `${topOffset}px` } : {};

  // 최소화 모드
  if (minimized) {
    return (
      <div className="absolute left-4 w-[200px] z-10
                      bg-[rgba(40,40,45,0.85)] border border-white/10 rounded-xl
                      px-3 py-2.5 backdrop-blur-[20px]
                      max-sm:left-2 max-sm:w-[180px]"
           style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)', ...topStyle }}>
        <div className="flex items-center gap-1.5">
          <span className="traffic-light traffic-light--close" title="닫기" onClick={onClose} />
          <span className="traffic-light traffic-light--minimize" title="최소화" onClick={onMinimize} />
          <span className="traffic-light traffic-light--expand" title="확장" onClick={onExpand} />
          <span className="text-btc-orange font-bold text-[10px] tracking-widest ml-2">CHAIN</span>
          <span className="text-muted text-[10px] ml-auto font-mono">
            #{latestHeight?.toLocaleString() ?? '?'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute left-4 w-[200px] z-10
                    bg-[rgba(40,40,45,0.85)] border border-white/10 rounded-xl
                    px-3 py-3 backdrop-blur-[20px]
                    max-sm:left-2 max-sm:w-[180px]"
         style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)', ...topStyle }}>
      {/* 신호등 + 타이틀 */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="traffic-light traffic-light--close" title="닫기" onClick={onClose} />
        <span className="traffic-light traffic-light--minimize" title="최소화" onClick={onMinimize} />
        <span className="traffic-light traffic-light--expand" title="확장" onClick={onExpand} />
        <span className="text-btc-orange font-bold text-[10px] tracking-widest ml-2">CHAIN</span>
      </div>

      {/* 세로 블록 목록 */}
      <div className="flex flex-col gap-1.5">
        {blocks.map((block) => (
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
    </div>
  );
}
