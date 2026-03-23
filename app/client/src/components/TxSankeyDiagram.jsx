import React, { useMemo, useState } from 'react';
import { formatBtc, shortAddr } from '../utils/format.jsx';

/**
 * TxSankeyDiagram — mempool.space 스타일 filled-area Sankey
 *
 * Props:
 *   inputs   — [{ address, value, type }]
 *   outputs  — [{ address, value, type }]
 *   fee      — number (sats)
 */
const PADDING = 14;
const PADDING_BOTTOM = 24; // INPUTS/OUTPUTS 라벨 공간
const BAR_W = 10;
const LABEL_W = 110;
const MIN_H = 200;
const MAX_H = 440;
const SVG_W = 520;
const MAX_ITEMS = 8;

export default function TxSankeyDiagram({ inputs = [], outputs = [], fee = 0 }) {
  const [hidden, setHidden] = useState(false);

  const diagram = useMemo(() => {
    // 8개 초과 시 요약
    const displayInputs = inputs.length > MAX_ITEMS
      ? [...inputs.slice(0, MAX_ITEMS - 1), {
          address: `…${inputs.length - MAX_ITEMS + 1} more`,
          value: inputs.slice(MAX_ITEMS - 1).reduce((s, i) => s + (i.value || 0), 0),
          type: null,
          isSummary: true,
        }]
      : inputs;

    const outEntries = [...outputs.map(o => ({ ...o, isFee: false }))];
    if (fee > 0) outEntries.push({ address: 'Fee', value: fee, isFee: true });

    const displayOutputs = outEntries.length > MAX_ITEMS
      ? [...outEntries.slice(0, MAX_ITEMS - 1), {
          address: `…${outEntries.length - MAX_ITEMS + 1} more`,
          value: outEntries.slice(MAX_ITEMS - 1).reduce((s, o) => s + (o.value || 0), 0),
          isFee: false,
          isSummary: true,
        }]
      : outEntries;

    const totalIn = displayInputs.reduce((s, i) => s + (i.value || 0), 0) || 1;
    const totalOut = displayOutputs.reduce((s, o) => s + (o.value || 0), 0) || 1;

    const maxItems = Math.max(displayInputs.length, displayOutputs.length);
    const chartH = Math.min(MAX_H, Math.max(MIN_H, maxItems * 38 + PADDING_BOTTOM));
    const usableH = chartH - PADDING - PADDING_BOTTOM;
    const gap = 3;

    // 입력 바 위치
    const inputBars = [];
    let iy = PADDING;
    displayInputs.forEach((inp, idx) => {
      const h = Math.max(6, ((inp.value || 0) / totalIn) * (usableH - (displayInputs.length - 1) * gap));
      inputBars.push({ ...inp, y: iy, h, idx });
      iy += h + gap;
    });

    // 출력 바 위치
    const outputBars = [];
    let oy = PADDING;
    displayOutputs.forEach((out, idx) => {
      const h = Math.max(6, ((out.value || 0) / totalOut) * (usableH - (displayOutputs.length - 1) * gap));
      outputBars.push({ ...out, y: oy, h, idx });
      oy += h + gap;
    });

    return { inputBars, outputBars, chartH, totalIn, totalOut };
  }, [inputs, outputs, fee]);

  const { inputBars, outputBars, chartH, totalIn, totalOut } = diagram;
  const leftX = LABEL_W + PADDING;
  const rightX = SVG_W - LABEL_W - PADDING;
  const midSpan = rightX - leftX - BAR_W;

  // 색상: purple-blue 그라데이션 (mempool.space 스타일)
  const getColor = (value, total, isFee) => {
    if (isFee) return '#f7931a';
    const ratio = Math.min(1, (value || 0) / (total || 1));
    // purple(#8b5cf6) → blue(#3b82f6)
    const r = Math.round(139 + ratio * (59 - 139));
    const g = Math.round(92 + ratio * (130 - 92));
    const b = Math.round(246 + ratio * (246 - 246));
    return `rgb(${r},${g},${b})`;
  };

  // filled-area 경로 생성: 각 input에서 outputs로 비례 분배
  const flowPaths = useMemo(() => {
    if (!inputBars.length || !outputBars.length) return [];

    const paths = [];
    const cx1Ratio = 0.38;
    const cx2Ratio = 0.62;

    // 각 input bar에서 각 output bar로의 흐름 비율
    inputBars.forEach((inp, i) => {
      let inOffset = 0;
      outputBars.forEach((out, j) => {
        // input의 높이를 output 비율로 분배
        const flowRatio = (out.value || 0) / totalOut;
        const flowH = Math.max(1, inp.h * flowRatio);

        // output에서의 높이도 input 비율로 분배
        const outFlowRatio = (inp.value || 0) / totalIn;
        const outFlowH = Math.max(1, out.h * outFlowRatio);

        // input 시작점 (상단/하단)
        const inY1 = inp.y + inOffset;
        const inY2 = inY1 + flowH;

        // output 목표점 계산
        // 각 output bar 내에서 이전 inputs이 차지한 공간 이후부터
        let outOffset = 0;
        for (let k = 0; k < i; k++) {
          const prevRatio = (inputBars[k].value || 0) / totalIn;
          outOffset += out.h * prevRatio;
        }
        const outY1 = out.y + outOffset;
        const outY2 = outY1 + outFlowH;

        const x1 = leftX + BAR_W;
        const x2 = rightX;
        const cx1 = x1 + midSpan * cx1Ratio;
        const cx2 = x1 + midSpan * cx2Ratio;

        // filled cubic bezier area
        const d = `M ${x1} ${inY1}
                   C ${cx1} ${inY1}, ${cx2} ${outY1}, ${x2} ${outY1}
                   L ${x2} ${outY2}
                   C ${cx2} ${outY2}, ${cx1} ${inY2}, ${x1} ${inY2}
                   Z`;

        const color = out.isFee ? '#f7931a' : getColor(inp.value, totalIn, false);

        paths.push({ d, color, key: `${i}-${j}` });
        inOffset += flowH;
      });
    });

    return paths;
  }, [inputBars, outputBars, totalIn, totalOut, leftX, rightX, midSpan]);

  return (
    <div className="relative">
      {/* Hide 토글 */}
      <div className="flex justify-end mb-1">
        <button
          onClick={() => setHidden(!hidden)}
          className="text-label text-muted hover:text-text-secondary cursor-pointer
                     bg-transparent border-none transition-colors"
        >
          {hidden ? 'Show diagram ▾' : 'Hide diagram ▴'}
        </button>
      </div>

      {!hidden && (
        <svg width="100%" viewBox={`0 0 ${SVG_W} ${chartH}`} className="block">
          <defs>
            {flowPaths.map(({ key, color }) => (
              <linearGradient key={`g-${key}`} id={`sankey-g-${key}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity="0.55" />
                <stop offset="50%" stopColor={color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={color} stopOpacity="0.55" />
              </linearGradient>
            ))}
          </defs>

          {/* Filled flow paths */}
          {flowPaths.map(({ d, key }) => (
            <path
              key={`flow-${key}`}
              d={d}
              fill={`url(#sankey-g-${key})`}
              stroke="none"
            />
          ))}

          {/* 왼쪽 입력 바 + 라벨 */}
          {inputBars.map((inp, i) => (
            <g key={`in-${i}`}>
              <rect x={leftX} y={inp.y} width={BAR_W} height={inp.h} rx={3}
                    fill={getColor(inp.value, totalIn, false)} />
              <text x={leftX - 4} y={inp.y + inp.h / 2 - 1} textAnchor="end"
                    dominantBaseline="middle"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fill: 'var(--color-text-secondary)' }}>
                {inp.isSummary ? inp.address : shortAddr(inp.address)}
              </text>
              <text x={leftX - 4} y={inp.y + inp.h / 2 + 11} textAnchor="end"
                    dominantBaseline="middle"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fill: 'var(--color-text-dim)' }}>
                {formatBtc(inp.value)} BTC
              </text>
            </g>
          ))}

          {/* 오른쪽 출력 바 + 라벨 */}
          {outputBars.map((out, j) => (
            <g key={`out-${j}`}>
              <rect x={rightX} y={out.y} width={BAR_W} height={out.h} rx={3}
                    fill={out.isFee ? '#f7931a' : getColor(out.value, totalOut, false)} />
              <text x={rightX + BAR_W + 4} y={out.y + out.h / 2 - 1} textAnchor="start"
                    dominantBaseline="middle"
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      fill: out.isFee ? '#f7931a' : 'var(--color-text-secondary)',
                    }}>
                {out.isFee ? '⚡ Fee' : out.isSummary ? out.address : shortAddr(out.address)}
              </text>
              <text x={rightX + BAR_W + 4} y={out.y + out.h / 2 + 11} textAnchor="start"
                    dominantBaseline="middle"
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      fill: out.isFee ? '#f7931a' : 'var(--color-text-dim)',
                    }}>
                {formatBtc(out.value)} BTC
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
      )}
    </div>
  );
}
