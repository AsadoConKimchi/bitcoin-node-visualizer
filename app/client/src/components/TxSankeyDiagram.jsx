import React, { useMemo } from 'react';

/**
 * TxSankeyDiagram — SVG 기반 input→output 흐름 다이어그램
 *
 * Props:
 *   inputs   — [{ address, value, type }]
 *   outputs  — [{ address, value, type }]
 *   fee      — number (sats)
 */
const PADDING = 12;
const BAR_W = 8;
const LABEL_W = 100;
const MIN_H = 200;
const MAX_H = 400;

function shortAddr(addr) {
  if (!addr) return '???';
  if (addr.length <= 16) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function formatBtc(sats) {
  if (sats == null) return '?';
  return (sats / 1e8).toFixed(8);
}

export default function TxSankeyDiagram({ inputs = [], outputs = [], fee = 0 }) {
  const diagram = useMemo(() => {
    const totalIn = inputs.reduce((s, i) => s + (i.value || 0), 0) || 1;
    // output + fee 합산
    const outEntries = [...outputs.map(o => ({ ...o, isFee: false }))];
    if (fee > 0) outEntries.push({ address: 'Fee', value: fee, isFee: true });
    const totalOut = outEntries.reduce((s, o) => s + (o.value || 0), 0) || 1;

    // 차트 높이: 항목 수에 따라 동적
    const maxItems = Math.max(inputs.length, outEntries.length);
    const chartH = Math.min(MAX_H, Math.max(MIN_H, maxItems * 32));
    const usableH = chartH - PADDING * 2;

    // 입력 바 위치 계산
    const inputBars = [];
    let iy = PADDING;
    inputs.forEach((inp, idx) => {
      const h = Math.max(4, (inp.value / totalIn) * usableH);
      inputBars.push({ ...inp, y: iy, h, idx });
      iy += h + 2;
    });

    // 출력 바 위치 계산
    const outputBars = [];
    let oy = PADDING;
    outEntries.forEach((out, idx) => {
      const h = Math.max(4, (out.value / totalOut) * usableH);
      outputBars.push({ ...out, y: oy, h, idx });
      oy += h + 2;
    });

    return { inputBars, outputBars, chartH, totalIn, totalOut };
  }, [inputs, outputs, fee]);

  const { inputBars, outputBars, chartH } = diagram;
  const svgW = 360;
  const leftX = LABEL_W + PADDING;
  const rightX = svgW - LABEL_W - PADDING;

  // 색상: 금액에 비례한 cyan → blue 그라데이션
  const getColor = (value, total, isFee) => {
    if (isFee) return '#f59e0b';
    const ratio = Math.min(1, (value || 0) / (total || 1));
    // cyan(#06b6d4) → blue(#3b82f6)
    const r = Math.round(6 + ratio * (59 - 6));
    const g = Math.round(182 + ratio * (130 - 182));
    const b = Math.round(212 + ratio * (246 - 212));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="relative" style={{ minHeight: MIN_H }}>
      <svg width="100%" viewBox={`0 0 ${svgW} ${chartH}`} className="block">
        <defs>
          {inputBars.map((inp, i) =>
            outputBars.map((out, j) => (
              <linearGradient key={`g-${i}-${j}`} id={`flow-${i}-${j}`}>
                <stop offset="0%" stopColor={getColor(inp.value, diagram.totalIn, false)} stopOpacity="0.5" />
                <stop offset="100%" stopColor={getColor(out.value, diagram.totalOut, out.isFee)} stopOpacity="0.5" />
              </linearGradient>
            ))
          )}
        </defs>

        {/* 흐름 경로: 각 input → 해당 비례 output */}
        {inputBars.map((inp, i) => {
          // 단순화: 각 input을 모든 output에 비례 분배
          return outputBars.map((out, j) => {
            const flowH = Math.max(1, (inp.h * out.h) / (chartH - PADDING * 2));
            const inY = inp.y + inp.h / 2;
            const outY = out.y + out.h / 2;
            const cx1 = leftX + BAR_W + (rightX - leftX - BAR_W) * 0.35;
            const cx2 = leftX + BAR_W + (rightX - leftX - BAR_W) * 0.65;

            return (
              <path
                key={`f-${i}-${j}`}
                d={`M ${leftX + BAR_W} ${inY}
                    C ${cx1} ${inY}, ${cx2} ${outY}, ${rightX} ${outY}`}
                fill="none"
                stroke={`url(#flow-${i}-${j})`}
                strokeWidth={Math.max(1.5, flowH)}
                opacity={0.6}
              />
            );
          });
        })}

        {/* 왼쪽 입력 바 */}
        {inputBars.map((inp, i) => (
          <g key={`in-${i}`}>
            <rect x={leftX} y={inp.y} width={BAR_W} height={inp.h} rx={2}
                  fill={getColor(inp.value, diagram.totalIn, false)} />
            {/* 주소 라벨 */}
            <text x={leftX - 4} y={inp.y + inp.h / 2} textAnchor="end"
                  className="text-[10px] fill-text-secondary" dominantBaseline="middle"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
              {shortAddr(inp.address)}
            </text>
            {/* 금액 */}
            <text x={leftX - 4} y={inp.y + inp.h / 2 + 12} textAnchor="end"
                  className="fill-text-dim" dominantBaseline="middle"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
              {formatBtc(inp.value)}
            </text>
          </g>
        ))}

        {/* 오른쪽 출력 바 */}
        {outputBars.map((out, j) => (
          <g key={`out-${j}`}>
            <rect x={rightX} y={out.y} width={BAR_W} height={out.h} rx={2}
                  fill={getColor(out.value, diagram.totalOut, out.isFee)} />
            {/* 주소 라벨 */}
            <text x={rightX + BAR_W + 4} y={out.y + out.h / 2} textAnchor="start"
                  className="text-[10px]" dominantBaseline="middle"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    fill: out.isFee ? '#f59e0b' : 'var(--color-text-secondary)',
                  }}>
              {out.isFee ? '⚡ Fee' : shortAddr(out.address)}
            </text>
            {/* 금액 */}
            <text x={rightX + BAR_W + 4} y={out.y + out.h / 2 + 12} textAnchor="start"
                  dominantBaseline="middle"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '9px',
                    fill: out.isFee ? '#f59e0b' : 'var(--color-text-dim)',
                  }}>
              {formatBtc(out.value)}
            </text>
          </g>
        ))}

        {/* 좌우 라벨 */}
        <text x={leftX + BAR_W / 2} y={chartH - 2} textAnchor="middle"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fill: 'var(--color-muted)' }}>
          INPUTS
        </text>
        <text x={rightX + BAR_W / 2} y={chartH - 2} textAnchor="middle"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fill: 'var(--color-muted)' }}>
          OUTPUTS
        </text>
      </svg>
    </div>
  );
}
