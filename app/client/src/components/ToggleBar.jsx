import React from 'react';

const BUTTONS = [
  { key: 'p2p', label: 'P2P', icon: '◉', color: 'btc-orange' },
  { key: 'verifyCenter', label: '검증센터', icon: '▣', color: 'btc-orange' },
  { key: 'internals', label: 'Internals', icon: '⚙', color: 'btc-orange' },
];

// 각 토글별 활성 스타일
const ACTIVE_STYLES = {
  'btc-orange': 'bg-btc-orange text-black border-btc-orange',
};

const INACTIVE_STYLES = {
  'btc-orange': 'bg-transparent text-btc-orange border-btc-orange/60 hover:bg-btc-orange/10',
};

export default function ToggleBar({ visible, onToggle }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20
                    bg-[rgba(40,40,45,0.85)] border border-white/10 rounded-xl
                    px-2 py-1.5 backdrop-blur-[20px]
                    md:gap-2 md:px-3 md:py-2"
         style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {BUTTONS.map(({ key, label, icon, color }) => {
        const active = visible[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={`font-mono text-xs px-2.5 py-1.5 rounded cursor-pointer
                       border transition-all duration-150 tracking-wide
                       md:px-3.5 md:py-1.5 md:text-sm
                       ${active ? ACTIVE_STYLES[color] : INACTIVE_STYLES[color]}`}
          >
            <span className="hidden sm:inline mr-1">{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
