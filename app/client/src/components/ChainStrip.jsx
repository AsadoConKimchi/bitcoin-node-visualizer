import React from 'react';
import MacWindow from './MacWindow.jsx';

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
  hudHeight,
}) {
  if (!recentBlocks?.length) return null;

  const blocks = [...recentBlocks]
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0))
    .slice(-5);

  const latestHeight = blocks[blocks.length - 1]?.height;
  const topY = (hudHeight || 56) + 16;

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
      headerRight={
        <span className="text-muted text-[11px] ml-auto font-mono">
          #{latestHeight?.toLocaleString() ?? '?'}
        </span>
      }
    >
      <div className="px-3 py-2 flex flex-col gap-1.5">
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
    </MacWindow>
  );
}
