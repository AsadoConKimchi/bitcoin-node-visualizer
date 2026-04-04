import React, { useRef, useState, useEffect } from 'react';

const BUTTONS = [
  { key: 'p2p', label: 'P2P 연결', icon: '🌐' },
  { key: 'verifyCenter', label: '검증', icon: '✓' },
  { key: 'internals', label: '내부 탐색', icon: '🔍' },
];

const CONTEXT_BANNERS = {
  p2p: '지구본: 피어 연결과 데이터 전파를 시각화합니다',
  verifyCenter: '지구본: 블록/TX 전파 경로를 시각화합니다',
  internals: '지구본: 네트워크 맵을 표시합니다',
};

export default function ToggleBar({ visible, onToggle, onSettingsClick }) {
  const containerRef = useRef(null);
  const buttonRefs = useRef({});
  const [pillStyle, setPillStyle] = useState(null);
  const [banner, setBanner] = useState(null);
  const bannerTimerRef = useRef(null);

  // 활성 키 찾기
  const activeKey = BUTTONS.find(b => visible[b.key])?.key || null;

  // 슬라이딩 pill 위치 계산
  useEffect(() => {
    if (!activeKey || !buttonRefs.current[activeKey] || !containerRef.current) {
      setPillStyle(null);
      return;
    }
    const btn = buttonRefs.current[activeKey];
    const container = containerRef.current;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setPillStyle({
      left: btnRect.left - containerRect.left,
      top: btnRect.top - containerRect.top,
      width: btnRect.width,
      height: btnRect.height,
    });
  }, [activeKey, visible]);

  // 컨텍스트 배너 표시
  const handleToggle = (key) => {
    onToggle(key);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    // 활성화될 때만 배너 표시
    if (!visible[key]) {
      setBanner(CONTEXT_BANNERS[key]);
      bannerTimerRef.current = setTimeout(() => setBanner(null), 2000);
    } else {
      setBanner(null);
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-0.5 z-[var(--z-modal)]
                    bg-panel-bg border border-dark-border rounded-xl
                    p-1 backdrop-blur-xl
                    md:gap-0.5 md:p-1.5"
        style={{ boxShadow: 'var(--shadow-panel-layered)' }}
      >
        {/* 슬라이딩 pill 배경 */}
        {pillStyle && (
          <div
            className="absolute bg-white/18 rounded-lg shadow-sm transition-all duration-300 ease-out pointer-events-none"
            style={{
              left: pillStyle.left,
              top: pillStyle.top,
              width: pillStyle.width,
              height: pillStyle.height,
            }}
          />
        )}

        {BUTTONS.map(({ key, label, icon }) => {
          const active = visible[key];
          return (
            <button
              key={key}
              ref={el => { buttonRefs.current[key] = el; }}
              onClick={() => handleToggle(key)}
              aria-label={`${label} 토글`}
              aria-pressed={active}
              className={`relative text-xs px-2.5 py-1.5 rounded-lg cursor-pointer
                         transition-all duration-150 tracking-wide focus-ring
                         md:px-3.5 md:py-1.5 md:text-sm
                         ${active
                           ? 'text-white font-medium'
                           : 'text-slate-300 hover:text-text-primary hover:bg-white/5'}`}
            >
              <span className="hidden sm:inline mr-1">{icon}</span>
              {label}
            </button>
          );
        })}

        {/* Settings 구분선 + 버튼 */}
        {onSettingsClick && (
          <>
            <div className="border-l border-dark-border mx-0.5" />
            <button
              onClick={onSettingsClick}
              aria-label="설정 열기"
              className="text-xs px-3 py-2.5 rounded-lg cursor-pointer
                         transition-colors duration-150 focus-ring
                         text-text-secondary hover:text-text-primary hover:bg-white/5
                         md:px-2.5 md:py-1.5 md:text-sm min-w-[44px] min-h-[44px]
                         flex items-center justify-center"
            >
              ⚙
            </button>
          </>
        )}
      </div>

      {/* 컨텍스트 배너 */}
      {banner && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[var(--z-modal)]
                        bg-panel-bg/90 border border-dark-border rounded-lg
                        px-4 py-1.5 backdrop-blur-xl
                        text-text-secondary text-xs tracking-wide
                        animate-fade-in"
             style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
          {banner}
        </div>
      )}
    </>
  );
}
