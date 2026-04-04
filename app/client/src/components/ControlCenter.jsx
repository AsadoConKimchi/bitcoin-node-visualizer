import React, { useState, useCallback } from 'react';

// 탭 정의 (학습 순서대로)
const TABS = [
  { key: 'nodeInfo',    label: '연결',   desc: '당신의 노드가 전 세계 다른 노드와 어떻게 연결되어 있는지 봅니다' },
  { key: 'txStream',    label: 'TX검증', desc: '누군가 비트코인을 보냈습니다 — 노드가 그 거래를 6단계로 검증합니다' },
  { key: 'blockVerify', label: '블록',   desc: '약 10분마다 새 블록이 도착합니다 — 7가지를 확인합니다' },
  { key: 'chainTips',   label: '체인',   desc: '노드가 추적하는 블록체인의 끝점들' },
  { key: 'internals',   label: '깊이',   desc: '풀노드 내부의 저장소, 보안, 프로토콜을 탐색합니다' },
];

// ToggleBar 키 → ControlCenter 탭 매핑
export const TOGGLE_TO_TAB = {
  p2p: 'nodeInfo',
  verifyCenter: 'txStream',
  internals: 'internals',
};

export default function ControlCenter({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  reorgBanner,
  children,
  mode,
  blockHeight,
}) {
  if (collapsed) {
    const isLive = mode === 'live' || mode === 'electrum';
    return (
      <div
        className="absolute top-0 right-0 bottom-0 z-[var(--z-hud)]
                   flex flex-col items-center justify-between py-3
                   bg-panel-bg border-l border-white/10 backdrop-blur-xl w-7"
      >
        {/* 펼치기 버튼 */}
        <button
          onClick={onToggleCollapse}
          className="text-text-secondary hover:text-text-primary transition-colors text-sm cursor-pointer"
          aria-label="관제센터 열기"
        >
          ◂
        </button>
        {/* 연결 상태 dot */}
        <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-400' : 'bg-orange-400 animate-pulse'}`} />
        {/* 블록 높이 세로 텍스트 */}
        {blockHeight != null && (
          <span
            className="text-muted-dim font-mono"
            style={{ writingMode: 'vertical-rl', fontSize: 9, letterSpacing: '0.05em' }}
          >
            #{blockHeight.toLocaleString()}
          </span>
        )}
        {/* 하단 여백 밸런서 */}
        <span />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-panel-bg border-l border-white/10 backdrop-blur-xl overflow-hidden"
         style={{ paddingRight: 16 }}>
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

      {/* 교육 배너 — 현재 탭 설명 */}
      {(() => {
        const tab = TABS.find(t => t.key === activeTab);
        return tab?.desc ? (
          <div className="px-3.5 py-2 shrink-0 bg-btc-orange/5 border-b border-btc-orange/10
                          text-[10px] text-text-secondary leading-relaxed">
            {tab.desc}
          </div>
        ) : null;
      })()}

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {children}
      </div>
    </div>
  );
}
