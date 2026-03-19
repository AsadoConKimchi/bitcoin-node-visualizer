import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import BitfeedFloor from './BitfeedFloor.jsx';

// ── 공유 유틸 ──────────────────────────────────────────────────────────────────

function feeColor(feeRate) {
  if (feeRate >= 50) return '#ef4444';
  if (feeRate >= 20) return '#f59e0b';
  if (feeRate >= 10) return '#34d399';
  return '#60a5fa';
}

// ── MiniProgress (6단계 도트) ──────────────────────────────────────────────────

function MiniProgress({ steps }) {
  if (!steps?.length) return null;
  return (
    <span className="inline-flex gap-[3px] items-center ml-1">
      {steps.map((step, i) => {
        const color = step.status === 'done' ? '#22c55e'
          : step.status === 'fail' ? '#ef4444'
          : step.status === 'active' ? '#f7931a'
          : '#4b5563';
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: color,
              transition: 'background-color 0.3s',
            }}
            title={step.name}
          />
        );
      })}
    </span>
  );
}

// ── TX 검증 단계 상세 ──────────────────────────────────────────────────────────

const TX_STEP_DETAILS = {
  '구문 파싱': 'TX 데이터 구조(버전, vin/vout 배열, locktime)가 프로토콜 규격에 맞는지 파싱합니다.',
  'IsStandard 검사': 'TX가 표준 스크립트 유형(P2PKH, P2SH, P2WPKH, P2WSH, P2TR)을 사용하는지 확인합니다.',
  'UTXO 조회': '각 입력이 참조하는 UTXO가 UTXO 세트에 실제로 존재하는지 확인합니다.',
  '이중 지불 검사': '같은 UTXO를 소비하는 다른 TX가 멤풀에 이미 존재하지 않는지 확인합니다.',
  '서명 검증': 'secp256k1 타원곡선 위에서 각 입력의 디지털 서명을 검증합니다.',
  '금액 합산': '입력 합계 ≥ 출력 합계인지 확인합니다. 차이가 채굴자 수수료가 됩니다.',
};

function InlineStepRow({ step }) {
  const icons = { done: '✓', active: '⟳', waiting: '–', fail: '✗' };
  const colors = { done: 'text-success', active: 'text-warning', waiting: 'text-muted-dim', fail: 'text-error' };
  const icon = icons[step.status] || '–';
  const color = colors[step.status] || 'text-muted-dim';
  const [expanded, setExpanded] = useState(false);
  const detail = TX_STEP_DETAILS[step.name];

  return (
    <div>
      <div
        className={`flex justify-between py-1 gap-2 ${detail ? 'cursor-pointer hover:bg-white/5 rounded px-1 -mx-1' : ''}`}
        onClick={(e) => { e.stopPropagation(); detail && setExpanded(!expanded); }}
      >
        <span className={`${color} min-w-[14px] text-sm`}>{icon}</span>
        <span className={`flex-1 text-sm ${step.status === 'waiting' ? 'text-text-dim' : 'text-text-primary'}`}>
          {step.name}
          {detail && <span className="text-muted ml-1 text-[10px]">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className="text-muted text-[10px]">{step.detail}</span>
      </div>
      {expanded && detail && (
        <div className="text-[10px] text-muted ml-5 mr-1 mb-1 leading-relaxed bg-dark-surface/50 rounded px-2 py-1.5">
          {detail}
        </div>
      )}
    </div>
  );
}

// ── TX 스트림 섹션 ──────────────────────────────────────────────────────────────

function TxStreamSection({ txStream, onTxClick }) {
  const [expandedTxid, setExpandedTxid] = useState(null);

  const handleClick = useCallback((txid) => {
    setExpandedTxid((prev) => prev === txid ? null : txid);
  }, []);

  if (txStream.length === 0) {
    return <div className="text-muted-dim text-sm text-center py-4">TX 대기 중…</div>;
  }

  return (
    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
      {txStream.map((tx) => {
        const isDone = tx.status === 'done' || tx.status === 'animating';
        const isFailed = tx.status === 'failed';
        const isAnimating = tx.status === 'animating';
        const isExpanded = expandedTxid === tx.txid;
        const short = tx.txid ? tx.txid.slice(0, 10) + '…' : '?';

        // TX 메타 정보
        const snap = tx.verifySnapshot;
        const txFeeRate = snap?.feeRate ?? tx.data?.feeRate;
        const txSize = snap?.size ?? tx.data?.size;
        const txWeight = snap?.weight ?? tx.data?.weight;
        const txVin = snap?.vin ?? tx.data?.vin;
        const txVout = snap?.vout ?? tx.data?.vout;

        return (
          <div key={tx.txid}>
            <div
              onClick={() => handleClick(tx.txid)}
              className={`px-2 py-1.5 rounded cursor-pointer
                         transition-all duration-500
                         ${isFailed ? 'bg-error/10' : isExpanded ? 'bg-tx-blue/10' : 'hover:bg-tx-blue/5'}
                         ${isAnimating ? 'opacity-0 translate-y-5' : ''}`}
              style={isAnimating ? {
                opacity: 0,
                transform: 'translateY(20px)',
                boxShadow: '0 0 12px rgba(34,197,94,0.3)',
              } : undefined}
            >
              {/* Line 1: icon + txid + mini dots */}
              <div className="flex items-center gap-2">
                <span className={`text-sm min-w-[14px] ${isFailed ? 'text-error' : isDone ? 'text-success' : 'text-warning'}`}>
                  {isFailed ? '✗' : isDone ? '✓' : '⟳'}
                </span>
                <span className={`text-sm font-mono ${isFailed ? 'text-error/70' : isDone ? 'text-success/70' : 'text-text-primary'}`}>
                  {short}
                </span>
                {isFailed && tx.failReason && (
                  <span className="text-error text-[10px] ml-1">{tx.failReason}</span>
                )}
                <span className="ml-auto text-text-dim text-[10px] flex items-center">
                  {isFailed ? '반려' : isAnimating ? '→ 멤풀' : snap?.steps
                    ? <MiniProgress steps={snap.steps} />
                    : '검증중'}
                </span>
              </div>
              {/* Line 2: feeRate · size/weight · vin→vout */}
              <div className="flex items-center gap-1.5 ml-6 mt-0.5 text-[10px] font-mono">
                {txFeeRate != null && (
                  <span style={{ color: feeColor(txFeeRate) }}>{txFeeRate} sat/vB</span>
                )}
                {(txSize != null || txWeight != null) && (
                  <span className="text-text-dim">
                    {txSize != null && `${txSize}B`}
                    {txSize != null && txWeight != null && ' · '}
                    {txWeight != null && `${txWeight}WU`}
                  </span>
                )}
                {txVin != null && txVout != null && (
                  <span className="text-muted">{txVin}in → {txVout}out</span>
                )}
              </div>
            </div>

            {/* 인라인 검증 상세 */}
            {isExpanded && tx.verifySnapshot && (
              <div className="ml-3 mr-1 my-1.5 px-3 py-2 bg-dark-surface/60 border border-tx-blue/20 rounded">
                <div className="text-tx-blue font-bold text-[10px] tracking-widest mb-1.5">
                  ▸ TX 검증 {tx.verifySnapshot.done && !isFailed && <span className="text-success">완료 ✓</span>}
                  {isFailed && <span className="text-error">실패 ✗</span>}
                </div>
                {tx.verifySnapshot.short && (
                  <div className="text-muted text-[10px] mb-1">{tx.verifySnapshot.short}</div>
                )}
                {(tx.verifySnapshot.size != null || tx.verifySnapshot.weight != null) && (
                  <div className="text-btc-orange/30 text-[10px] mb-1.5">
                    {tx.verifySnapshot.size != null && `${tx.verifySnapshot.size} B`}
                    {tx.verifySnapshot.size != null && tx.verifySnapshot.weight != null && ' · '}
                    {tx.verifySnapshot.weight != null && `${tx.verifySnapshot.weight} WU`}
                  </div>
                )}
                {tx.verifySnapshot.steps.map((step, i) => (
                  <InlineStepRow key={i} step={step} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 블록 검증 단계 상세 ─────────────────────────────────────────────────────────

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
          {detail && <span className="text-muted ml-1 text-[10px]">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className="text-muted text-[10px] font-mono">{step.detail}</span>
      </div>
      {expanded && detail && (
        <div className="text-[10px] text-muted ml-5 mr-1 mb-1 leading-relaxed bg-dark-surface/50 rounded px-2 py-1.5">
          {detail}
        </div>
      )}
    </div>
  );
}

// ── 머클트리 (확장 버전 — SVG 연결선 포함) ────────────────────────────────────

function MerkleNode({ label, done, active, x, y }) {
  const bgClass = done ? 'bg-green-900' : active ? 'bg-yellow-900' : 'bg-dark-surface';
  const borderClass = done ? 'border-success' : active ? 'border-warning' : 'border-dark-border';
  const textClass = done ? 'text-success' : active ? 'text-warning' : 'text-muted-dim';

  return (
    <div className={`${bgClass} border ${borderClass} ${textClass} rounded
                    text-[11px] px-2 py-1 text-center min-w-[64px] font-mono
                    transition-all duration-300 ${active ? 'animate-pulse' : ''}`}>
      {label}
    </div>
  );
}

function MerkleTree({ merkle }) {
  if (!merkle) return null;
  const { leaves, level2, level1, root, doneCount } = merkle;
  const svgRef = useRef(null);
  const treeRef = useRef(null);
  const [lines, setLines] = useState([]);

  // SVG 연결선 계산
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

        // 각 부모 노드는 2개의 자식에 연결
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

            newLines.push({
              x1: px, y1: py,
              x2: cx, y2: cy,
              done: parentDone,
            });
          }
        });
      });
    }

    setLines(newLines);
  }, [merkle, doneCount]);

  if (!leaves.length && !root) return null;

  return (
    <div ref={treeRef} className="mt-3 border-t border-dark-border pt-3 relative">
      <div className="text-block-purple text-[10px] font-bold tracking-widest mb-2">MERKLE TREE</div>

      {/* SVG 연결선 */}
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

// ── 블록 헤더 80바이트 시각화 ──────────────────────────────────────────────────

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

  // 검증 진행에 따라 색상 결정
  const headerParsed = steps?.[0]?.status === 'done';
  const powDone = steps?.[1]?.status === 'done';
  const allDone = steps?.every((s) => s.status === 'done');

  const [hoveredSeg, setHoveredSeg] = useState(null);

  // 각 세그먼트의 실제 값
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
      <div className="text-block-purple text-[10px] font-bold tracking-widest mb-1.5">BLOCK HEADER (80 BYTES)</div>
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
              className={`relative flex items-center justify-center text-[9px] font-mono
                         border-r last:border-r-0 cursor-default transition-colors duration-300
                         ${segColor} ${isHovered ? 'bg-block-purple/20' : ''}`}
              style={{ width: `${widthPercent}%`, minWidth: seg.bytes <= 4 ? '36px' : undefined }}
              onMouseEnter={() => setHoveredSeg(seg.name)}
              onMouseLeave={() => setHoveredSeg(null)}
            >
              <span className={`${isHovered ? 'text-block-purple' : headerParsed ? 'text-text-secondary' : 'text-text-dim'} truncate px-0.5`}>
                {headerParsed && seg.bytes <= 4 ? values[seg.field] || seg.name : seg.bytes <= 4 ? seg.name : seg.name.slice(0, 6)}
              </span>
              <span className="text-[7px] text-muted absolute bottom-0 right-0.5">{seg.bytes}B</span>

              {/* 호버 툴팁 */}
              {isHovered && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-panel-bg-solid border border-block-purple/40
                               rounded px-2 py-0.5 text-[9px] text-block-purple whitespace-nowrap z-20 pointer-events-none">
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

// ── 블록 검증 섹션 (확장 버전) ──────────────────────────────────────────────────

function BlockVerifySection({ verifyState }) {
  if (!verifyState) {
    return <div className="text-muted-dim text-sm text-center py-4">블록 대기 중…</div>;
  }
  const { blockData, steps, merkle } = verifyState;

  // 진행률 계산
  const doneSteps = steps.filter(s => s.status === 'done').length;
  const progress = Math.round((doneSteps / steps.length) * 100);

  return (
    <div className="overflow-y-auto flex-1 min-h-0">
      {/* 블록 정보 헤더 */}
      <div className="text-text-secondary text-sm mb-1">
        Block #{blockData?.height?.toLocaleString() ?? '?'}
        {blockData?.pool ? ` · ${blockData.pool}` : ''}
        {blockData?.txCount && (
          <span className="text-muted ml-1 text-[10px]">{blockData.txCount.toLocaleString()} TX</span>
        )}
      </div>
      {blockData?.hash && (
        <div className="text-text-dim text-[10px] mb-2 font-mono">{blockData.hash.slice(0, 24)}…</div>
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
      {steps.map((step, i) => (
        <BlockStepRow key={i} step={step} />
      ))}

      {/* 머클 루트 해시 (검증 완료 시) */}
      {merkle && doneSteps === steps.length && blockData?.merkleRoot && (
        <div className="mt-2 text-[10px] font-mono text-success/70 bg-success/5 rounded px-2 py-1">
          Merkle Root: {blockData.merkleRoot}
        </div>
      )}

      {/* 확장된 머클트리 */}
      <MerkleTree merkle={merkle} />
    </div>
  );
}

// ── 메인 패널 ───────────────────────────────────────────────────────────────────

export default function MainPanel({
  txStream,
  blockVerifyState,
  mempoolCount,
  visible,
  onTxClick,
  onClose,
  bitfeedRef,
}) {
  const [minimized, setMinimized] = useState(false);

  if (!visible) return null;

  const txCount = txStream.length;
  const verifyingCount = txStream.filter((t) => t.status === 'verifying').length;
  const failedCount = txStream.filter((t) => t.status === 'failed').length;

  return (
    <div
      className={`absolute right-0 top-0 z-10
                  bg-[rgba(40,40,45,0.85)] border-l border-white/10
                  backdrop-blur-[20px] overflow-hidden flex flex-col
                  transition-all duration-300
                  max-sm:right-0 max-sm:left-0 max-sm:w-full max-sm:border-l-0
                  ${minimized ? 'h-[44px]' : 'h-full'}`}
      style={{
        width: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : '75%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── 헤더 바 (macOS 윈도우 스타일) ── */}
      <div className="flex items-center px-4 py-2.5 shrink-0 border-b border-white/10 bg-[rgba(30,30,35,0.95)]">
        <div className="flex items-center gap-1.5 mr-3">
          <span className="traffic-light traffic-light--close" title="닫기" onClick={onClose} />
          <span className="traffic-light traffic-light--minimize" title={minimized ? '확장' : '최소화'} onClick={() => setMinimized(!minimized)} />
          <span className="traffic-light traffic-light--expand" />
        </div>
        <span className="text-btc-orange font-bold text-sm tracking-widest flex-1 text-center">
          VERIFICATION CENTER
        </span>
        {minimized && (
          <span className="text-muted text-[10px] font-mono">
            TX {txCount}건
            {failedCount > 0 && ` (✗${failedCount})`}
            {' · '}
            멤풀 {mempoolCount?.toLocaleString() ?? '?'}
          </span>
        )}
      </div>

      {/* ── 콘텐츠 ── */}
      {!minimized && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 상단: TX검증 + 블록검증 (가로 분할) */}
          <div className="flex min-h-0 flex-[45]">
            {/* TX 검증 */}
            <div className="flex flex-col min-h-0 px-4 py-3 overflow-hidden flex-[50] border-r border-white/10">
              <div className="text-tx-blue font-bold text-xs tracking-widest mb-2 shrink-0 flex justify-between">
                <span>▸ TX VERIFICATION</span>
                <span className="text-muted font-normal">
                  {txCount}건
                  {verifyingCount > 0 && ` (⟳${verifyingCount})`}
                  {failedCount > 0 && <span className="text-error ml-1">✗{failedCount}</span>}
                </span>
              </div>
              <TxStreamSection txStream={txStream} onTxClick={onTxClick} />
            </div>

            {/* 블록 검증 */}
            <div className="flex flex-col min-h-0 px-4 py-3 overflow-hidden flex-[50]">
              <div className="text-block-purple font-bold text-xs tracking-widest mb-2 shrink-0">
                ▸ BLOCK VERIFICATION
              </div>
              <BlockVerifySection verifyState={blockVerifyState} />
            </div>
          </div>

          {/* 하단: Bitfeed 바닥 */}
          <div className="flex flex-col min-h-0 border-t border-white/10 flex-[55]"
               style={{ background: 'rgba(6, 10, 20, 0.96)' }}
          >
            {/* Bitfeed 헤더 */}
            <div className="flex justify-between items-center px-4 py-2 shrink-0">
              <span className="text-mempool-green font-bold text-xs tracking-widest">▸ MEMPOOL FLOOR</span>
              <span className="text-muted text-[10px]">
                {mempoolCount != null ? `${mempoolCount.toLocaleString()} TX` : '—'}
              </span>
            </div>

            {/* Canvas 영역 */}
            <div className="flex-1 min-h-0 px-2 pb-2 relative">
              <BitfeedFloor ref={bitfeedRef} />

              {/* 범례 */}
              <div className="absolute bottom-3 right-3 flex gap-3 text-[9px] bg-[rgba(6,10,20,0.8)] rounded px-2 py-1">
                <span className="text-[#ef4444]">● 50+ sat/vB</span>
                <span className="text-[#f59e0b]">● 20+</span>
                <span className="text-[#34d399]">● 10+</span>
                <span className="text-[#60a5fa]">● {'<'}10</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
