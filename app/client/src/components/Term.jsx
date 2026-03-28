import React, { useState } from 'react';
import { GLOSSARY } from '../utils/glossary.js';

/**
 * 교육용 용어 컴포넌트
 * 사용: <Term k="mempool" /> → "Mempool" 표시, 호버 시 설명 툴팁
 * 사용: <Term k="mempool" label="커스텀 라벨" />
 */
export default function Term({ k, label, className = '' }) {
  const [show, setShow] = useState(false);
  const entry = GLOSSARY[k];
  if (!entry) return <span className={className}>{label || k}</span>;

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="border-b border-dotted border-text-dim/40 cursor-help">
        {label || entry.term}
      </span>
      {show && (
        <span className="absolute left-0 bottom-full mb-1 z-50 w-[240px]
                         bg-dark-bg border border-white/15 rounded-lg px-3 py-2
                         text-[10px] leading-relaxed text-text-secondary
                         shadow-lg pointer-events-none"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <span className="block text-btc-orange font-bold text-[11px] mb-0.5">
            {entry.term}
            {entry.short && <span className="text-text-dim font-normal ml-1">— {entry.short}</span>}
          </span>
          {entry.full}
        </span>
      )}
    </span>
  );
}
