import React, { useState, useMemo, useRef, useEffect } from 'react';
import { feeColor } from '../utils/colors.js';
import { squarify } from '../utils/treemap.js';

export default function MempoolPoolPanel({ mempoolTxs, mempoolCount, mempoolInfo, onTxClick }) {
  const [hoveredTxid, setHoveredTxid] = useState(null);
  const [pulsingTxids, setPulsingTxids] = useState(new Set());
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 220, h: 140 });
  const prevTxidsRef = useRef(new Set());

  // 컨테이너 크기 측정
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 새로 추가된 TX 감지 → pulse 애니메이션
  useEffect(() => {
    const currentIds = new Set(mempoolTxs.map((t) => t.txid));
    const newIds = new Set();
    for (const id of currentIds) {
      if (!prevTxidsRef.current.has(id)) newIds.add(id);
    }
    prevTxidsRef.current = currentIds;

    if (newIds.size > 0) {
      setPulsingTxids(newIds);
      const timer = setTimeout(() => setPulsingTxids(new Set()), 800);
      return () => clearTimeout(timer);
    }
  }, [mempoolTxs]);

  // Treemap 계산
  const rects = useMemo(() => {
    return squarify(mempoolTxs, dims.w, dims.h);
  }, [mempoolTxs, dims.w, dims.h]);

  // 총 vBytes: 서버 데이터 우선, 없으면 로컬 계산
  const totalVB = useMemo(() => {
    if (mempoolInfo?.vsize) return mempoolInfo.vsize;
    if (mempoolInfo?.bytes) return mempoolInfo.bytes;
    return mempoolTxs.reduce((s, t) => s + (t.weight ? Math.ceil(t.weight / 4) : 140), 0);
  }, [mempoolTxs, mempoolInfo]);

  const totalVBStr = totalVB >= 1e6 ? `${(totalVB / 1e6).toFixed(1)} MvB` : `${totalVB.toLocaleString()} vB`;

  return (
    <div className="absolute bottom-[90px] left-4
                    w-[240px] h-[200px]
                    bg-panel-bg border border-white/10
                    rounded-xl px-3 py-2 font-mono backdrop-blur-[20px] z-10
                    flex flex-col
                    max-sm:left-2 max-sm:w-[190px] max-sm:bottom-[80px] max-sm:h-[160px]">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-1.5 shrink-0">
        <span className="text-mempool-green font-bold text-xs tracking-wide">▸ MEMPOOL</span>
        <span className="text-muted text-[9px]">
          {mempoolCount != null ? `${mempoolCount.toLocaleString()} TX` : '—'}
          {totalVB > 0 && ` · ${totalVBStr}`}
        </span>
      </div>

      {/* Treemap 영역 */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden rounded">
        {mempoolTxs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-dim text-xs">
            검증 완료된 TX가 여기에 표시됩니다
          </div>
        )}

        <svg width={dims.w} height={dims.h} className="absolute inset-0">
          {rects.map((r) => {
            const color = feeColor(r.feeRate || 5);
            const isHovered = hoveredTxid === r.txid;
            const isPulsing = pulsingTxids.has(r.txid);

            return (
              <g key={r.txid}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={Math.max(0, r.w - 1)}
                  height={Math.max(0, r.h - 1)}
                  fill={isHovered ? `${color}44` : `${color}22`}
                  stroke={isHovered ? `${color}cc` : `${color}66`}
                  strokeWidth={isHovered ? 1.5 : 0.5}
                  rx={2}
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => onTxClick?.({ txid: r.txid, data: r.data })}
                  onMouseEnter={() => setHoveredTxid(r.txid)}
                  onMouseLeave={() => setHoveredTxid(null)}
                >
                  {isPulsing && (
                    <animate
                      attributeName="opacity"
                      values="1;0.3;1"
                      dur="0.8s"
                      repeatCount="2"
                    />
                  )}
                </rect>
                {/* TX 라벨 (충분히 큰 사각형에만) */}
                {r.w > 35 && r.h > 14 && (
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2 + 3}
                    textAnchor="middle"
                    fill={`${color}99`}
                    fontSize={8}
                    fontFamily="monospace"
                    className="pointer-events-none"
                  >
                    {r.txid?.slice(0, 6)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* 호버 툴팁 */}
        {hoveredTxid && (() => {
          const r = rects.find((r) => r.txid === hoveredTxid);
          if (!r) return null;
          const short = r.txid?.slice(0, 8) || '?';
          return (
            <div
              className="absolute bg-panel-bg-solid rounded px-2 py-1
                        text-[9px] text-text-primary whitespace-nowrap z-12 pointer-events-none
                        border border-mempool-green/40"
              style={{
                left: Math.min(r.x + r.w / 2, dims.w - 100),
                top: Math.max(0, r.y - 24),
              }}
            >
              {short}… · {r.feeRate ? `${r.feeRate} sat/vB` : '?'} · {r.weight ? `${r.weight} WU` : '?'}
            </div>
          );
        })()}
      </div>

      {/* 수수료 색상 범례 */}
      <div className="flex gap-3 mt-1 text-[8px] shrink-0 justify-end">
        <span className="text-[#ef4444]">● 50+ sat/vB</span>
        <span className="text-[#f59e0b]">● 20+</span>
        <span className="text-[#22c55e]">● 10+</span>
        <span className="text-[#60a5fa]">● {'<'}10</span>
      </div>
    </div>
  );
}
