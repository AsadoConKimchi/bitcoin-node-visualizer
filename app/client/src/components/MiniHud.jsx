import React from 'react';

/**
 * MiniHud — 모드 전환 시 핵심 지표 미니 표시
 * 노드 정보 모드가 아닐 때 좌상단에 높이/수수료/멤풀 3개 지표만 한 줄로 표시
 */
export default function MiniHud({ blockHeight, feeRate, mempoolCount, mode, onClick }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-14 left-1/2 -translate-x-1/2 z-[var(--z-hud-float)]
                 flex items-center gap-3 px-3.5 py-1.5
                 bg-panel-bg/85 border border-dark-border rounded-full
                 backdrop-blur-xl cursor-pointer
                 hover:bg-panel-bg transition-colors
                 max-sm:gap-2 max-sm:px-2.5"
      style={{ boxShadow: 'var(--shadow-panel)' }}
      title="노드 정보 모드로 전환"
    >
      {/* 상태 점 */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${mode === 'live' ? 'bg-success' : 'bg-warning'}`} />

      <span className="text-label font-mono text-btc-orange font-bold">
        #{blockHeight?.toLocaleString() ?? '—'}
      </span>
      <span className="text-label-sm text-text-secondary">
        {feeRate != null ? `~${feeRate} sat/vB` : '—'}
      </span>
      <span className="text-label-sm text-mempool-green">
        {mempoolCount != null ? `${(mempoolCount / 1000).toFixed(1)}k TX` : '—'}
      </span>
    </button>
  );
}
