import React, { forwardRef, useRef, useState, useEffect, useMemo, useCallback } from 'react';

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

/* 카테고리 그룹핑용 매핑 */
const CATEGORY_MAP = {
  'valid-fork': 'FORK',
  'valid-headers': 'HEADERS',
  'headers-only': 'HDR-ONLY',
  'invalid': 'INVALID',
};

const CATEGORY_COLOR = {
  'FORK': 'text-orange-500',
  'HEADERS': 'text-yellow-400',
  'HDR-ONLY': 'text-yellow-700',
  'INVALID': 'text-error',
};

/* 클립보드 복사 버튼 */
function CopyHashBtn({ hash }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback((e) => {
    e.stopPropagation();
    if (!hash) return;
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [hash]);

  return (
    <button
      onClick={handleCopy}
      title={copied ? '복사됨' : '해시 복사'}
      className="ml-1 px-1 py-0 bg-transparent border-none cursor-pointer
                 text-text-dim hover:text-text-secondary transition-colors"
      style={{ fontSize: '10px', lineHeight: 1 }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

/* 툴팁이 있는 ? 아이콘 */
function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full
                       border border-text-dim/40 text-text-dim text-[9px] leading-none
                       cursor-help select-none ml-1">?</span>
      {show && (
        <span className="absolute left-5 top-1/2 -translate-y-1/2 z-50
                         bg-dark-bg border border-white/10 rounded px-2 py-1
                         text-[10px] text-text-secondary whitespace-nowrap
                         shadow-lg pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

const ChainTipsPanel = forwardRef(function ChainTipsPanel({ chaintips, embedded = false }, ref) {
  if (!chaintips?.length) return null;

  const prevActiveRef = useRef(null);
  const [reorgEvent, setReorgEvent] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const activeTip = chaintips.find((t) => t.status === 'active');

  // Reorg 감지
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

  // 카테고리별 그룹핑 (embedded 확장 뷰용)
  const grouped = useMemo(() => {
    const groups = {};
    for (const tip of forks) {
      const cat = CATEGORY_MAP[tip.status] || tip.status.toUpperCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tip);
    }
    return groups;
  }, [forks]);

  // 비embedded용 hooks (조건부 return 전에 선언)
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const visibleForks = useMemo(() => {
    if (tipsExpanded) return forks;
    return forks.slice(0, 2);
  }, [forks, tipsExpanded]);

  // --- embedded 모드 전용 렌더링 ---
  if (embedded) {
    return (
      <div ref={ref} className="px-3.5 py-2.5 font-mono text-sm text-text-primary leading-6">
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

        {/* 교육용 설명 + ? 툴팁 */}
        <div className="flex items-center gap-1 mb-1.5 text-text-dim text-[10px]">
          <span>노드가 알고 있는 모든 체인의 끝점</span>
          <InfoTooltip text="블록체인은 하나의 직선이 아닙니다. 노드는 여러 분기(fork)를 추적하며, 가장 많은 작업증명이 쌓인 체인을 선택합니다." />
        </div>

        {/* 컴팩트 기본 뷰: Active tip 한 줄 + fork 수 뱃지 */}
        {activeTip && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between gap-2
                       bg-transparent border-none cursor-pointer p-0
                       text-left font-mono text-sm text-text-primary"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-success text-xs">●</span>
              <span className="font-bold text-xs">ACTIVE</span>
              <span className="text-text-primary">#{activeTip.height.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-2">
              {forks.length > 0 && (
                <span className="bg-orange-500/15 text-orange-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {forks.length} fork{forks.length !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-text-dim text-[10px]">{expanded ? '▴' : '▾'}</span>
            </span>
          </button>
        )}

        {/* 확장 뷰: 카테고리별 그룹 */}
        {expanded && (
          <div className="mt-2 pt-2 border-t border-dark-border">
            {Object.keys(grouped).length === 0 ? (
              <div className="text-text-dim text-xs">분기 없음</div>
            ) : (
              Object.entries(grouped).map(([cat, tips]) => (
                <div key={cat} className="mb-2 last:mb-0">
                  {/* 카테고리 헤더 */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] font-bold ${CATEGORY_COLOR[cat] || 'text-text-dim'}`}>
                      {cat}
                    </span>
                    <span className="text-text-dim text-[10px]">({tips.length})</span>
                  </div>
                  {/* 팁 목록 */}
                  {tips.map((tip) => {
                    const isReverted = reorgEvent && tip.hash === reorgEvent.prevHash;
                    return (
                      <div
                        key={tip.hash}
                        className={`flex items-center justify-between py-0.5 pl-2
                                   ${isReverted ? 'opacity-50 border-l-2 border-error' : 'border-l border-white/5'}`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={`text-xs ${isReverted ? 'text-error' : 'text-text-primary'}`}>
                            #{tip.height.toLocaleString()}
                          </span>
                          {tip.branchlen > 0 && (
                            <span className="text-text-dim text-[10px]">{tip.branchlen} blk</span>
                          )}
                        </span>
                        <CopyHashBtn hash={tip.hash} />
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // --- 비embedded 모드 (기존 유지) ---

  const standaloneContent = (
    <>
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
    </>
  );

  return (
    <div ref={ref} className="absolute top-14 right-4 bg-panel-bg border border-white/10
                    rounded-xl px-3.5 py-2.5 font-mono text-sm text-text-primary
                    backdrop-blur-xl leading-7 min-w-[260px] max-w-[320px] z-[var(--z-hud)]
                    max-sm:right-2 max-sm:min-w-[220px]"
         style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
      {standaloneContent}
    </div>
  );
});

export default ChainTipsPanel;
