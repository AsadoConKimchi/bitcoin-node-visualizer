import React from 'react';

const BUTTONS = [
  { key: 'p2p', label: '노드 정보', icon: '◉' },
  { key: 'verifyCenter', label: '검증센터', icon: '▣' },
  { key: 'internals', label: 'Internals', icon: '🔧' },
];

export default function ToggleBar({ visible, onToggle }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-0.5 z-20
                    bg-panel-bg border border-white/8 rounded-xl
                    p-1 backdrop-blur-[20px]
                    md:gap-0.5 md:p-1.5"
         style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
      {BUTTONS.map(({ key, label, icon }) => {
        const active = visible[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            aria-label={`${label} 토글`}
            aria-pressed={active}
            className={`text-xs px-2.5 py-1.5 rounded-lg cursor-pointer
                       transition-all duration-150 tracking-wide
                       md:px-3.5 md:py-1.5 md:text-sm
                       ${active
                         ? 'bg-white/12 text-white font-medium shadow-sm'
                         : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
          >
            <span className="hidden sm:inline mr-1">{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
