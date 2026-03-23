import React, { useState, useEffect, useRef } from 'react';

const STEP_DURATION = 1200;
const TOTAL_STEPS = 4;

export default function CompactBlockPanel({ recentBlocks, mempoolCount, forceReplay }) {
  const [animState, setAnimState] = useState(null);
  const lastBlockRef = useRef(null);
  const timersRef = useRef([]);

  // 블록 도착 시 자동 트리거
  useEffect(() => {
    if (!recentBlocks?.length) return;
    const latest = recentBlocks[0];
    if (!latest?.hash || latest.hash === lastBlockRef.current) return;
    lastBlockRef.current = latest.hash;
    startAnimation(latest);
  }, [recentBlocks]);

  // 수동 재트리거
  useEffect(() => {
    if (!forceReplay?.block) return;
    startAnimation(forceReplay.block);
  }, [forceReplay]);

  function startAnimation(block) {
    const matchPct = 90 + Math.floor(Math.random() * 9);

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const steps = [
      { step: 0, label: '블록 헤더 + short IDs 수신', icon: '↓' },
      { step: 1, label: `멤풀 TX 매칭 (${matchPct}% 히트)`, icon: '⟳' },
      { step: 2, label: `누락 TX ${100 - matchPct}% 요청`, icon: '→' },
      { step: 3, label: '블록 조립 완료', icon: '✓' },
    ];

    for (let i = 0; i < steps.length; i++) {
      const t = setTimeout(() => {
        setAnimState({
          step: steps[i].step,
          block,
          matchPct,
          steps,
          done: i === steps.length - 1,
        });
      }, i * STEP_DURATION);
      timersRef.current.push(t);
    }

    const hideTimer = setTimeout(() => setAnimState(null), TOTAL_STEPS * STEP_DURATION + 3000);
    timersRef.current.push(hideTimer);
  }

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  if (!animState) return null;
  const { step, block, matchPct, steps, done } = animState;

  return (
    <>
    {/* 백드롭 — 뒤쪽 패널 클릭 차단 */}
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[var(--z-modal-backdrop)]"
         onClick={() => {
           timersRef.current.forEach(clearTimeout);
           timersRef.current = [];
           setAnimState(null);
         }} />
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  w-[340px] bg-panel-bg-solid border border-white/10
                  rounded-xl px-4 py-3.5 font-mono text-sm text-text-primary
                  backdrop-blur-md z-[var(--z-modal)]
                  max-sm:w-[calc(100vw-32px)]
                  animate-[fadeScaleIn_0.3s_ease-out]"
      style={{
        animation: 'fadeScaleIn 0.3s ease-out',
      }}
    >
      {/* 헤더 + 닫기 버튼 */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-blue-400 font-bold text-xs tracking-wide flex items-center gap-2">
            <span>▸ COMPACT BLOCK RELAY</span>
            {done && <span className="text-success">완료 ✓</span>}
          </div>
          <div className="text-muted-dim text-label-xs mt-0.5">
            새 블록 수신 시 자동 표시
          </div>
        </div>
        <button
          onClick={() => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
            setAnimState(null);
          }}
          className="text-muted hover:text-text-primary text-sm cursor-pointer
                     w-5 h-5 flex items-center justify-center rounded focus-ring
                     hover:bg-white/10 transition-colors -mt-0.5 -mr-1"
        >
          ✕
        </button>
      </div>

      <div className="text-muted text-xs mb-2">
        Block #{block?.height?.toLocaleString() ?? '?'} · {block?.txCount?.toLocaleString() ?? '?'} TX
      </div>

      {/* 단계별 흐름 */}
      {steps.map((s, i) => {
        const isActive = step === s.step;
        const isDone = step > s.step;
        const colorClass = isDone ? 'text-success' : isActive ? 'text-warning' : 'text-muted-dim';
        const icon = isDone ? '✓' : isActive ? '⟳' : '–';
        return (
          <div key={i} className={`flex gap-2 py-0.5 ${colorClass}`}>
            <span className="min-w-[14px] text-sm">{icon}</span>
            <span className="text-sm">{s.label}</span>
          </div>
        );
      })}

      {/* 다이어그램 */}
      <div className="mt-2.5 p-2.5 bg-dark-surface border border-blue-400/20 rounded text-xs text-blue-400">
        <div className="flex justify-between">
          <span>멤풀 히트율</span>
          <span className={matchPct >= 95 ? 'text-success' : 'text-warning'}>{matchPct}%</span>
        </div>
        <div className="h-1.5 bg-dark-border rounded mt-1">
          <div
            className="h-full rounded transition-[width] duration-800 ease-out"
            style={{
              width: step >= 1 ? `${matchPct}%` : '0%',
              background: 'linear-gradient(90deg, #60a5fa99, #4ade80)',
            }}
          />
        </div>
        <div className="text-muted text-label-xs mt-1">
          높은 히트율 = 대역폭 절약 (헤더만으로 블록 재구성)
        </div>
      </div>
    </div>
    </>
  );
}
