import React, { useRef, useState, useEffect, useMemo } from 'react';

const STATUS_COLOR = {
  'active': 'text-success',
  'valid-fork': 'text-orange-500',
  'valid-headers': 'text-yellow-400',
  'headers-only': 'text-yellow-700',
  'invalid': 'text-error',
};

const STATUS_LABEL = {
  'active': 'ACTIVE',
  'valid-fork': 'FORK',
  'valid-headers': 'HEADERS',
  'headers-only': 'HDR-ONLY',
  'invalid': 'INVALID',
};

export default function ChainTipsPanel({ chaintips }) {
  if (!chaintips?.length) return null;

  const prevActiveRef = useRef(null);
  const [reorgEvent, setReorgEvent] = useState(null);

  const activeTip = chaintips.find((t) => t.status === 'active');

  useEffect(() => {
    if (!activeTip) return;
    const prev = prevActiveRef.current;
    if (prev && prev.hash !== activeTip.hash) {
      const depth = prev.height - activeTip.height + 1;
      setReorgEvent({
        prevHash: prev.hash,
        prevHeight: prev.height,
        newHash: activeTip.hash,
        newHeight: activeTip.height,
        depth: Math.abs(depth) || 1,
        time: Date.now(),
      });
      const t = setTimeout(() => setReorgEvent(null), 15000);
      return () => clearTimeout(t);
    }
    prevActiveRef.current = { hash: activeTip.hash, height: activeTip.height };
  }, [activeTip?.hash]);

  const sorted = [...chaintips].sort((a, b) => {
    if (a.status === 'active') return -1;
    if (b.status === 'active') return 1;
    return b.height - a.height;
  });

  const forks = sorted.filter((t) => t.status !== 'active');
  const [tipsExpanded, setTipsExpanded] = useState(false);

  // 기본: 최근 FORK/HEADERS 2개만
  const visibleForks = useMemo(() => {
    if (tipsExpanded) return forks;
    return forks.slice(0, 2);
  }, [forks, tipsExpanded]);

  const hiddenCount = forks.length - visibleForks.length;

  return (
    <div className="absolute top-14 right-4 bg-panel-bg border border-white/10
                    rounded-xl px-3.5 py-2.5 font-mono text-sm text-text-primary
                    backdrop-blur-xl leading-7 min-w-[260px] max-w-[320px] z-[var(--z-hud)]
                    max-sm:right-2 max-sm:min-w-[220px]"
         style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
      {/* Reorg 배너 */}
      {reorgEvent && (
        <div className="bg-red-900 border border-error rounded px-2 py-1.5 mb-2
                       text-xs text-red-300 text-center"
             style={{ animation: 'pulse 1s infinite alternate' }}>
          ⚠ REORG 감지 — 깊이 {reorgEvent.depth}블록
          <div className="text-error/50 text-label-xs">
            #{reorgEvent.prevHeight} → #{reorgEvent.newHeight}
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-dark-border">
        <span className="font-bold text-xs tracking-wide">▸ CHAIN TIPS</span>
        <span className="text-text-dim text-xs">{chaintips.length} tips</span>
      </div>

      {/* Active 팁 */}
      {activeTip && (
        <div className="mb-1.5 pb-1.5 border-b border-dark-border">
          <div className="flex justify-between gap-2">
            <span className="text-success text-xs">● ACTIVE</span>
            <span className="text-text-primary">#{activeTip.height.toLocaleString()}</span>
          </div>
          <div className="text-text-dim text-xs">
            {activeTip.hash?.slice(0, 16)}…
          </div>
        </div>
      )}

      {/* 분기 기록 */}
      {forks.length === 0 ? (
        <div className="text-text-dim text-xs">분기 없음</div>
      ) : (
        <>
          {visibleForks.map((tip) => {
            const isReverted = reorgEvent && tip.hash === reorgEvent.prevHash;
            return (
              <div
                key={tip.hash}
                className={`mb-1 ${isReverted ? 'opacity-50 border-l-2 border-error pl-1.5' : ''}`}
              >
                <div className="flex justify-between gap-2">
                  <span className={`text-xs ${isReverted ? 'text-error' : (STATUS_COLOR[tip.status] || 'text-orange-500')}`}>
                    {isReverted ? 'REVERTED' : (STATUS_LABEL[tip.status] || tip.status.toUpperCase())}
                  </span>
                  <span className={isReverted ? 'text-muted' : 'text-text-primary'}>
                    #{tip.height.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-text-dim text-xs">
                  <span>{tip.hash?.slice(0, 12)}…</span>
                  {tip.branchlen > 0 && <span>{tip.branchlen} blk</span>}
                </div>
              </div>
            );
          })}
          {forks.length > 2 && (
            <button
              onClick={() => setTipsExpanded(e => !e)}
              className="w-full text-center text-label text-text-dim hover:text-text-secondary
                         cursor-pointer bg-transparent border-none mt-1 py-0.5"
            >
              {tipsExpanded ? '접기 ▴' : `${chaintips.length} tips 전체 보기 ▾`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
