import React from 'react';

/**
 * WindowDock — 화면 하단 중앙, 최소화된 윈도우 pill 표시
 *
 * Props:
 *   items — [{ key, title, titleColor, onRestore }]
 */
export default function WindowDock({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20
                    flex gap-2 px-3 py-2 panel-base">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={item.onRestore}
          className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer
                     transition-all duration-200
                     bg-white/8 hover:bg-white/15
                     ${item.titleColor || 'text-text-primary'}
                     font-bold tracking-wide`}
          title={`${item.title} 복원`}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}
