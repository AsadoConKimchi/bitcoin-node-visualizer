import React from 'react';

// 수수료 구간별 색상
function feeRangeColor(medianFee) {
  if (medianFee >= 50) return '#ef4444';
  if (medianFee >= 20) return '#f59e0b';
  if (medianFee >= 10) return '#22c55e';
  return '#60a5fa';
}

/**
 * MempoolBlocksPanel — 예상 블록 적층 시각화
 * mempool-blocks 데이터를 활용하여 다음 N개 블록에 포함될 TX를
 * 수수료 구간별로 적층 표시
 */
export default function MempoolBlocksPanel({ mempoolBlocks, visible, topOffset = 0 }) {
  if (!visible || !mempoolBlocks?.length) return null;

  // 최대 6개 블록만 표시
  const blocks = mempoolBlocks.slice(0, 6);
  const maxSize = Math.max(...blocks.map(b => b.blockSize || b.blockVSize || 1));

  return (
    <div className="absolute right-4 w-[260px] bg-panel-bg border border-dark-border
                    rounded-xl px-3.5 py-3 font-mono text-sm text-text-primary
                    backdrop-blur-xl z-[var(--z-hud)] panel-transition
                    max-sm:right-2 max-sm:w-[220px]"
         style={{ top: `${120 + topOffset}px`, boxShadow: 'var(--shadow-panel-layered)' }}>
      {/* 헤더 */}
      <div className="text-mempool-green font-bold text-xs tracking-wide mb-2 flex justify-between">
        <span>▸ 예상 블록</span>
        <span className="text-muted font-normal text-label-sm">{blocks.length}개</span>
      </div>

      {/* 적층 시각화 */}
      <div className="flex gap-1.5 items-end h-[120px]">
        {blocks.map((block, i) => {
          const txCount = block.nTx || 0;
          const sizePct = Math.max(20, ((block.blockSize || block.blockVSize || 0) / maxSize) * 100);
          const medianFee = block.medianFee || block.feeRange?.[3] || 0;
          const color = feeRangeColor(medianFee);

          // 수수료 분포 세그먼트
          const feeRange = block.feeRange || [];
          const segments = [];
          if (feeRange.length >= 7) {
            const ranges = [
              { fee: feeRange[6], label: 'high', color: '#ef4444' },
              { fee: feeRange[4], label: 'mid', color: '#f59e0b' },
              { fee: feeRange[2], label: 'low', color: '#22c55e' },
              { fee: feeRange[0], label: 'min', color: '#60a5fa' },
            ];
            const total = ranges.reduce((s, r) => s + (r.fee || 1), 0);
            ranges.forEach(r => {
              segments.push({ ...r, pct: Math.max(5, ((r.fee || 1) / total) * 100) });
            });
          }

          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              {/* 블록 바 */}
              <div
                className="w-full rounded-t relative overflow-hidden transition-all duration-500"
                style={{ height: `${sizePct}%`, minHeight: 24 }}
              >
                {segments.length > 0 ? (
                  segments.map((seg, si) => (
                    <div
                      key={si}
                      className="w-full"
                      style={{
                        height: `${seg.pct}%`,
                        background: `${seg.color}33`,
                        borderBottom: `1px solid ${seg.color}22`,
                      }}
                    />
                  ))
                ) : (
                  <div className="w-full h-full" style={{ background: `${color}33` }} />
                )}
                {/* 오버레이 테두리 */}
                <div className="absolute inset-0 border rounded-t" style={{ borderColor: `${color}66` }} />
              </div>

              {/* 블록 번호 */}
              <div className="text-label-xs text-muted mt-1">+{i + 1}</div>

              {/* TX 수 */}
              <div className="text-label-xs text-text-dim">{txCount}</div>

              {/* 수수료 */}
              <div className="text-label-xs" style={{ color }}>
                ~{Math.round(medianFee)}
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex justify-between mt-2 pt-1.5 border-t border-dark-border text-label-xs text-muted">
        <span>블록 번호</span>
        <span>TX 수</span>
        <span>중간 수수료 (sat/vB)</span>
      </div>

      {/* 수수료 색상 범례 */}
      <div className="flex gap-2 mt-1 text-label-xs">
        <span className="text-[#ef4444]">● 50+</span>
        <span className="text-[#f59e0b]">● 20+</span>
        <span className="text-[#22c55e]">● 10+</span>
        <span className="text-[#60a5fa]">● {'<'}10</span>
      </div>
    </div>
  );
}
