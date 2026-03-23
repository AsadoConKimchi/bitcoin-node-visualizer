import React, { useState, useRef, useEffect } from 'react';
import MacWindow from './MacWindow.jsx';

// ── 블록 검증 단계 상세 ──
const BLOCK_STEP_DETAILS = {
  '헤더 파싱': '블록 헤더(80바이트)를 파싱합니다. 버전, 이전 블록 해시, 머클 루트, 타임스탬프, 난이도 타겟, 논스를 추출합니다.',
  'PoW 검증': '블록 해시가 현재 난이도 타겟보다 작은지 검증합니다. SHA-256d(헤더) < target이면 유효한 작업증명입니다.',
  'Timestamp 검증': '타임스탬프가 MTP(최근 11블록 중앙값)보다 크고, 현재 시간 + 2시간보다 작은지 검증합니다.',
  'Coinbase 검증': '코인베이스 TX의 보상이 블록 보조금 + 수수료 합계를 초과하지 않는지 검증합니다.',
  'Merkle root': '블록 내 모든 TX의 해시를 이진 트리로 결합하여 계산한 머클 루트가 헤더의 값과 일치하는지 검증합니다.',
  '전체 TX 검증': '블록 내 모든 트랜잭션의 서명, 스크립트, 입출력을 개별 검증합니다.',
  'Weight 검증': '블록의 총 weight가 4,000,000 WU(1MB vsize 상당) 이하인지 검증합니다.',
};

function BlockStepRow({ step }) {
  const icons = { done: '✓', active: '⟳', waiting: '–', fail: '✗' };
  const colors = { done: 'text-success', active: 'text-warning', waiting: 'text-muted-dim', fail: 'text-error' };
  const icon = icons[step.status] || '–';
  const color = colors[step.status] || 'text-muted-dim';
  const [expanded, setExpanded] = useState(false);
  const detail = BLOCK_STEP_DETAILS[step.name];

  return (
    <div>
      <div
        className={`flex justify-between py-1.5 gap-2 ${detail ? 'cursor-pointer hover:bg-white/5 rounded px-1 -mx-1' : ''}`}
        onClick={() => detail && setExpanded(!expanded)}
      >
        <span className={`${color} min-w-[14px] text-sm ${step.status === 'active' ? 'animate-spin' : ''}`}>{icon}</span>
        <span className={`flex-1 text-sm ${step.status === 'waiting' ? 'text-text-dim' : 'text-text-primary'}`}>
          {step.name}
          {detail && <span className="text-muted ml-1 text-label">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className="text-muted text-label font-mono">{step.detail}</span>
      </div>
      {expanded && detail && (
        <div className="text-label text-muted ml-5 mr-1 mb-1 leading-relaxed bg-dark-surface/50 rounded px-2 py-1.5">
          {detail}
        </div>
      )}
    </div>
  );
}

// ── 머클 트리 노드 ──
function MerkleNode({ label, done, active }) {
  const bgClass = done ? 'bg-green-900' : active ? 'bg-yellow-900' : 'bg-dark-surface';
  const borderClass = done ? 'border-success' : active ? 'border-warning' : 'border-dark-border';
  const textClass = done ? 'text-success' : active ? 'text-warning' : 'text-muted-dim';

  return (
    <div className={`${bgClass} border ${borderClass} ${textClass} rounded
                    text-label px-2 py-1 text-center min-w-[64px] font-mono
                    transition-all duration-300 ${active ? 'animate-pulse' : ''}`}>
      {label}
    </div>
  );
}

// ── 머클 트리 (SVG 연결선 포함) ──
function MerkleTree({ merkle }) {
  if (!merkle) return null;
  const { leaves, level2, level1, root, doneCount } = merkle;
  const svgRef = useRef(null);
  const treeRef = useRef(null);
  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!treeRef.current) return;
    const container = treeRef.current;
    const rows = container.querySelectorAll('[data-tree-row]');
    if (rows.length < 2) return;

    const newLines = [];
    const containerRect = container.getBoundingClientRect();

    for (let rowIdx = 0; rowIdx < rows.length - 1; rowIdx++) {
      const parentRow = rows[rowIdx];
      const childRow = rows[rowIdx + 1];
      const parentNodes = parentRow.querySelectorAll('[data-tree-node]');
      const childNodes = childRow.querySelectorAll('[data-tree-node]');

      parentNodes.forEach((parent, pi) => {
        const pRect = parent.getBoundingClientRect();
        const px = pRect.left + pRect.width / 2 - containerRect.left;
        const py = pRect.bottom - containerRect.top;

        const ci1 = pi * 2;
        const ci2 = pi * 2 + 1;

        [ci1, ci2].forEach((ci) => {
          if (ci < childNodes.length) {
            const child = childNodes[ci];
            const cRect = child.getBoundingClientRect();
            const cx = cRect.left + cRect.width / 2 - containerRect.left;
            const cy = cRect.top - containerRect.top;

            const parentDone = rowIdx === 0
              ? doneCount >= 8
              : rowIdx === 1
                ? doneCount >= (pi + 1) * 4
                : doneCount >= (pi + 1) * 2;

            newLines.push({ x1: px, y1: py, x2: cx, y2: cy, done: parentDone });
          }
        });
      });
    }

    setLines(newLines);
  }, [merkle, doneCount]);

  if (!leaves.length && !root) return null;

  return (
    <div ref={treeRef} className="mt-3 border-t border-dark-border pt-3 relative">
      <div className="text-block-purple text-label font-bold tracking-wide mb-2">MERKLE TREE</div>

      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1} y1={l.y1}
            x2={l.x2} y2={l.y2}
            stroke={l.done ? '#4ade80' : '#334155'}
            strokeWidth={1.5}
            strokeDasharray={l.done ? 'none' : '3,3'}
            opacity={0.6}
          />
        ))}
      </svg>

      {/* Root */}
      <div className="flex justify-center mb-2 relative z-1" data-tree-row>
        <div data-tree-node>
          <MerkleNode label={`${root?.slice(0, 8)}…`} done={doneCount >= 8} active={doneCount >= 6} />
        </div>
      </div>

      {/* Level 1 */}
      {level1.length > 0 && (
        <div className="flex justify-around mb-2 relative z-1" data-tree-row>
          {level1.map((h, i) => (
            <div key={i} data-tree-node>
              <MerkleNode label={`h${i * 4}…${i * 4 + 3}`} done={doneCount >= (i + 1) * 4} active={doneCount >= i * 4 + 2} />
            </div>
          ))}
        </div>
      )}

      {/* Level 2 */}
      {level2.length > 0 && (
        <div className="flex justify-around mb-2 relative z-1" data-tree-row>
          {level2.map((h, i) => (
            <div key={i} data-tree-node>
              <MerkleNode label={`h${i * 2}${i * 2 + 1}`} done={doneCount >= (i + 1) * 2} active={doneCount === i * 2 + 1} />
            </div>
          ))}
        </div>
      )}

      {/* Leaves */}
      {leaves.length > 0 && (
        <div className="flex justify-around flex-wrap gap-1 relative z-1" data-tree-row>
          {leaves.map((h, i) => (
            <div key={i} data-tree-node>
              <MerkleNode label={h || `tx${i}`} done={doneCount > i} active={doneCount === i} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 블록 헤더 80바이트 시각화 ──
const HEADER_SEGMENTS = [
  { name: 'version', bytes: 4, field: 'version' },
  { name: 'prevBlockHash', bytes: 32, field: 'prevHash' },
  { name: 'merkleRoot', bytes: 32, field: 'merkleRoot' },
  { name: 'time', bytes: 4, field: 'time' },
  { name: 'nBits', bytes: 4, field: 'nBits' },
  { name: 'nonce', bytes: 4, field: 'nonce' },
];

function BlockHeaderBar({ blockData, steps }) {
  if (!blockData) return null;

  const headerParsed = steps?.[0]?.status === 'done';
  const allDone = steps?.every((s) => s.status === 'done');
  const [hoveredSeg, setHoveredSeg] = useState(null);

  const values = {
    version: blockData.version != null ? `0x${blockData.version.toString(16)}` : '?',
    prevHash: blockData.previousblockhash?.slice(0, 16) || blockData.hash?.slice(0, 16) || '?',
    merkleRoot: blockData.merkleRoot?.slice(0, 16) || '?',
    time: blockData.time ? new Date(blockData.time * 1000).toISOString().slice(11, 19) + ' UTC' : '?',
    nBits: blockData.nBits != null ? (typeof blockData.nBits === 'number' ? blockData.nBits.toString(16) : blockData.nBits) : '?',
    nonce: blockData.nonce?.toString() || '?',
  };

  return (
    <div className="mt-3 mb-2">
      <div className="text-block-purple text-label font-bold tracking-wide mb-1.5">BLOCK HEADER (80 BYTES)</div>
      <div className="flex rounded overflow-hidden border border-dark-border h-10">
        {HEADER_SEGMENTS.map((seg) => {
          const widthPercent = (seg.bytes / 80) * 100;
          const segColor = allDone ? 'bg-success/20 border-success/40'
            : headerParsed ? 'bg-btc-orange/15 border-btc-orange/30'
            : 'bg-dark-surface border-dark-border';
          const isHovered = hoveredSeg === seg.name;

          return (
            <div
              key={seg.name}
              className={`relative flex items-center justify-center text-label font-mono
                         border-r last:border-r-0 cursor-default transition-colors duration-300
                         ${segColor} ${isHovered ? 'bg-block-purple/20' : ''}`}
              style={{ width: `${widthPercent}%`, minWidth: seg.bytes <= 4 ? '36px' : undefined }}
              onMouseEnter={() => setHoveredSeg(seg.name)}
              onMouseLeave={() => setHoveredSeg(null)}
            >
              <span className={`${isHovered ? 'text-block-purple' : headerParsed ? 'text-text-secondary' : 'text-text-dim'} truncate px-0.5`}>
                {headerParsed && seg.bytes <= 4 ? values[seg.field] || seg.name : seg.bytes <= 4 ? seg.name : seg.name.slice(0, 6)}
              </span>
              <span className="text-label-xs text-muted absolute bottom-0 right-0.5">{seg.bytes}B</span>

              {isHovered && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-panel-bg-solid border border-block-purple/40
                               rounded px-2 py-0.5 text-label text-block-purple whitespace-nowrap z-20 pointer-events-none">
                  {values[seg.field] || '?'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 메인 BlockVerifyPanel ──
export default function BlockVerifyPanel({
  verifyState,
  visible,
  minimized,
  onClose,
  onMinimize,
  zIndex,
  onFocus,
}) {
  if (!visible) return null;

  const { blockData, steps, merkle } = verifyState || {};
  const doneSteps = steps?.filter(s => s.status === 'done').length || 0;
  const progress = steps ? Math.round((doneSteps / steps.length) * 100) : 0;

  return (
    <MacWindow
      title="BLOCK VERIFICATION"
      titleColor="text-block-purple"
      initialPosition={{ x: typeof window !== 'undefined' ? window.innerWidth - 380 : 800, y: 56 }}
      onClose={onClose}
      onMinimize={onMinimize}
      minimized={minimized}
      zIndex={zIndex}
      onFocus={onFocus}
      width={360}
      height="calc(100vh - 72px)"
      headerRight={
        verifyState && (
          <span className="text-muted text-label font-mono">
            {progress}%
          </span>
        )
      }
    >
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {!verifyState ? (
          <div className="text-muted-dim text-sm text-center py-4">블록 대기 중…</div>
        ) : (
          <>
            {/* 블록 정보 헤더 */}
            <div className="text-text-secondary text-sm mb-1">
              Block #{blockData?.height?.toLocaleString() ?? '?'}
              {blockData?.pool ? ` · ${blockData.pool}` : ''}
              {blockData?.txCount && (
                <span className="text-muted ml-1 text-label">{blockData.txCount.toLocaleString()} TX</span>
              )}
            </div>
            {blockData?.hash && (
              <div className="text-text-dim text-label mb-2 font-mono">{blockData.hash.slice(0, 24)}…</div>
            )}

            {/* 프로그레스 바 */}
            <div className="w-full h-1.5 bg-dark-surface rounded-full mb-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: progress === 100
                    ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                    : 'linear-gradient(90deg, #a78bfa, #7c3aed)',
                }}
              />
            </div>

            {/* 블록 헤더 시각화 */}
            <BlockHeaderBar blockData={blockData} steps={steps} />

            {/* 검증 단계 */}
            {steps?.map((step, i) => (
              <BlockStepRow key={i} step={step} />
            ))}

            {/* 머클 루트 해시 (완료 시) */}
            {merkle && doneSteps === steps?.length && blockData?.merkleRoot && (
              <div className="mt-2 text-label font-mono text-success/70 bg-success/5 rounded px-2 py-1">
                Merkle Root: {blockData.merkleRoot}
              </div>
            )}

            {/* 머클트리 */}
            <MerkleTree merkle={merkle} />
          </>
        )}
      </div>
    </MacWindow>
  );
}
