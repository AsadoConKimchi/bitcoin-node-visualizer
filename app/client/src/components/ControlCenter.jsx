import React, { useState, useCallback } from 'react';

// 탭 정의
const TABS = [
  { key: 'nodeInfo', label: '노드', icon: '◉' },
  { key: 'blockVerify', label: '블록', icon: '▣' },
  { key: 'txStream', label: 'TX', icon: '⟐' },
  { key: 'chainTips', label: '체인', icon: '⑂' },
  { key: 'internals', label: '구조', icon: '⚙' },
];

// ToggleBar 키 → ControlCenter 탭 매핑
export const TOGGLE_TO_TAB = {
  p2p: 'nodeInfo',
  verifyCenter: 'blockVerify',
  internals: 'internals',
};

export default function ControlCenter({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  reorgBanner,
  children,
}) {
  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="absolute top-1/2 right-0 -translate-y-1/2 z-[var(--z-hud)]
                   bg-panel-bg border border-white/10 border-r-0
                   rounded-l-lg px-1.5 py-6 cursor-pointer
                   text-text-secondary hover:text-text-primary hover:bg-white/5
                   transition-colors backdrop-blur-xl"
        aria-label="관제센터 열기"
      >
        ◂
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-panel-bg border-l border-white/10 backdrop-blur-xl overflow-hidden"
         style={{ paddingRight: 6 }}>
      {/* Reorg 배너 (탭과 무관하게 항상 표시) */}
      {reorgBanner}

      {/* 탭 바 */}
      <div className="flex shrink-0 bg-white/5 border-b border-dark-border overflow-hidden">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`flex-1 min-w-0 text-label py-2.5 px-1.5 cursor-pointer transition-colors
                       border-b-2 font-mono tracking-wide truncate
                       ${activeTab === key
                         ? 'border-btc-orange text-white font-medium bg-white/5'
                         : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5'
                       }`}
          >
            {label}
          </button>
        ))}

        {/* 접기 버튼 */}
        <button
          onClick={onToggleCollapse}
          className="shrink-0 px-2 py-2.5 cursor-pointer text-text-dim hover:text-text-primary
                     transition-colors border-b-2 border-transparent"
          aria-label="관제센터 접기"
        >
          ▸
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {children}
      </div>
    </div>
  );
}
