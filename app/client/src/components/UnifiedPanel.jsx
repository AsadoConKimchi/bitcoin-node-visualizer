import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { feeColor } from '../utils/colors.js';
import { squarify } from '../utils/treemap.js';

// ── 공유 컴포넌트 ────────────────────────────────────────────────────────────

// 6단계 미니 프로그레스 도트
function MiniProgress({ steps }) {
  if (!steps || !steps.length) return null;
  return (
    <span className="inline-flex gap-[2px] items-center ml-1">
      {steps.map((step, i) => {
        const color = step.status === 'done' ? '#22c55e'
          : step.status === 'active' ? '#f7931a'
          : '#4b5563';
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
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

// ── TX 검증 섹션 ─────────────────────────────────────────────────────────────

const TX_STEP_DETAILS = {
  '구문 파싱': 'TX 데이터 구조(버전, vin/vout 배열, locktime)가 프로토콜 규격에 맞는지 파싱합니다.',
  'IsStandard 검사': 'TX가 표준 스크립트 유형(P2PKH, P2SH, P2WPKH, P2WSH, P2TR)을 사용하는지 확인합니다.',
  'UTXO 조회': '각 입력이 참조하는 UTXO가 UTXO 세트에 실제로 존재하는지 확인합니다.',
  '이중 지불 검사': '같은 UTXO를 소비하는 다른 TX가 멤풀에 이미 존재하지 않는지 확인합니다.',
  '서명 검증': 'secp256k1 타원곡선 위에서 각 입력의 디지털 서명을 검증합니다.',
  '금액 합산': '입력 합계 ≥ 출력 합계인지 확인합니다. 차이가 채굴자 수수료가 됩니다.',
};

function InlineStepRow({ step }) {
  const icons = { done: '✓', active: '⟳', waiting: '–' };
  const colors = { done: 'text-success', active: 'text-warning', waiting: 'text-muted-dim' };
  const icon = icons[step.status] || '–';
  const color = colors[step.status] || 'text-muted-dim';
  const [expanded, setExpanded] = useState(false);
  const detail = TX_STEP_DETAILS[step.name];

  return (
    <div>
      <div
        className={`flex justify-between py-0.5 gap-1.5 ${detail ? 'cursor-pointer hover:bg-white/5 rounded px-0.5 -mx-0.5' : ''}`}
        onClick={(e) => { e.stopPropagation(); detail && setExpanded(!expanded); }}
      >
        <span className={`${color} min-w-[12px] text-xs`}>{icon}</span>
        <span className={`flex-1 text-xs ${step.status === 'waiting' ? 'text-text-dim' : 'text-text-primary'}`}>
          {step.name}
          {detail && <span className="text-muted ml-0.5 text-label-xs">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className="text-muted text-label-xs">{step.detail}</span>
      </div>
      {expanded && detail && (
        <div className="text-label-xs text-muted ml-4 mr-0.5 mb-0.5 leading-relaxed bg-dark-surface/50 rounded px-1.5 py-1">
          {detail}
        </div>
      )}
    </div>
  );
}

function TxStreamSection({ txStream, onTxClick }) {
  const [expandedTxid, setExpandedTxid] = useState(null);

  const handleClick = useCallback((txid) => {
    setExpandedTxid((prev) => prev === txid ? null : txid);
  }, []);

  if (txStream.length === 0) {
    return <div className="text-muted-dim text-xs text-center py-3">TX 대기 중…</div>;
  }

  return (
    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
      {txStream.map((tx) => {
        const isDone = tx.status === 'done' || tx.status === 'animating';
        const isAnimating = tx.status === 'animating';
        const isExpanded = expandedTxid === tx.txid;
        const short = tx.txid ? tx.txid.slice(0, 8) + '…' : '?';

        return (
          <div key={tx.txid}>
            <div
              onClick={() => handleClick(tx.txid)}
              className={`flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer
                         transition-all duration-500
                         ${isExpanded ? 'bg-tx-blue/10' : 'hover:bg-tx-blue/5'}
                         ${isAnimating ? 'opacity-0 translate-y-5' : ''}`}
              style={isAnimating ? {
                opacity: 0,
                transform: 'translateY(20px)',
                boxShadow: '0 0 12px rgba(34,197,94,0.3)',
              } : undefined}
            >
              <span className={`text-xs min-w-[12px] ${isDone ? 'text-success' : 'text-warning'}`}>
                {isDone ? '✓' : '⟳'}
              </span>
              <span className={`text-xs font-mono ${isDone ? 'text-success/70' : 'text-text-primary'}`}>
                {short}
              </span>
              <span className="ml-auto text-text-dim text-label-xs flex items-center">
                {isAnimating ? '→ 멤풀' : tx.verifySnapshot?.steps
                  ? <MiniProgress steps={tx.verifySnapshot.steps} />
                  : '검증중'}
              </span>
            </div>

            {/* 인라인 검증 상세 */}
            {isExpanded && tx.verifySnapshot && (
              <div className="ml-2 mr-0.5 my-1 px-2 py-1.5 bg-dark-surface/60 border border-tx-blue/20 rounded">
                <div className="text-tx-blue font-bold text-label-xs tracking-wide mb-1">
                  ▸ TX 검증 {tx.verifySnapshot.done && <span className="text-success">완료 ✓</span>}
                </div>
                {tx.verifySnapshot.short && (
                  <div className="text-muted text-label-xs mb-0.5">{tx.verifySnapshot.short}</div>
                )}
                {(tx.verifySnapshot.size != null || tx.verifySnapshot.weight != null) && (
                  <div className="text-btc-orange/30 text-label-xs mb-1">
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

// ── 블록 검증 섹션 ───────────────────────────────────────────────────────────

const BLOCK_STEP_DETAILS = {
  'Header Parsing': '블록 헤더(80바이트)를 파싱합니다. 버전, 이전 블록 해시, 머클 루트, 타임스탬프, 난이도 타겟, 논스를 추출합니다.',
  'PoW Validation': '블록 해시가 현재 난이도 타겟보다 작은지 검증합니다. SHA-256d(헤더) < target이면 유효한 작업증명입니다.',
  'Timestamp Validation': '타임스탬프가 MTP(최근 11블록 중앙값)보다 크고, 현재 시간 + 2시간보다 작은지 검증합니다.',
  'Coinbase Validation': '코인베이스 TX의 보상이 블록 보조금 + 수수료 합계를 초과하지 않는지 검증합니다.',
  'Merkle Root': '블록 내 모든 TX의 해시를 이진 트리로 결합하여 계산한 머클 루트가 헤더의 값과 일치하는지 검증합니다.',
  'TX Verification': '블록 내 모든 트랜잭션의 서명, 스크립트, 입출력을 개별 검증합니다.',
  'Weight Check': '블록의 총 weight가 4,000,000 WU(1MB vsize 상당) 이하인지 검증합니다.',
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
        className={`flex justify-between py-0.5 gap-1.5 ${detail ? 'cursor-pointer hover:bg-white/5 rounded px-0.5 -mx-0.5' : ''}`}
        onClick={() => detail && setExpanded(!expanded)}
      >
        <span className={`${color} min-w-[12px] text-xs`}>{icon}</span>
        <span className={`flex-1 text-xs ${step.status === 'waiting' ? 'text-text-dim' : 'text-text-primary'}`}>
          {step.name}
          {detail && <span className="text-muted ml-0.5 text-label-xs">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className="text-muted text-label-xs">{step.detail}</span>
      </div>
      {expanded && detail && (
        <div className="text-label-xs text-muted ml-4 mr-0.5 mb-0.5 leading-relaxed bg-dark-surface/50 rounded px-1.5 py-1">
          {detail}
        </div>
      )}
    </div>
  );
}

function MerkleNode({ label, done, active }) {
  const bgClass = done ? 'bg-green-900' : active ? 'bg-yellow-900' : 'bg-dark-surface';
  const borderClass = done ? 'border-success' : active ? 'border-warning' : 'border-dark-border';
  const textClass = done ? 'text-success' : active ? 'text-warning' : 'text-muted-dim';

  return (
    <div className={`${bgClass} border ${borderClass} ${textClass} rounded
                    text-label-xs px-1 py-0.5 text-center min-w-[32px] font-mono`}>
      {label}
    </div>
  );
}

function MerkleTree({ merkle }) {
  if (!merkle) return null;
  const { leaves, level2, level1, root, doneCount } = merkle;

  return (
    <div className="mt-2 border-t border-dark-border pt-2">
      <div className="flex justify-center mb-1">
        <MerkleNode label={`${root?.slice(0, 6)}…`} done={doneCount >= 8} active={doneCount >= 6} />
      </div>
      <div className="flex justify-around mb-1">
        {level1.map((h, i) => (
          <MerkleNode key={i} label={`h${i * 4}…${i * 4 + 3}`} done={doneCount >= (i + 1) * 4} active={doneCount >= i * 4 + 2} />
        ))}
      </div>
      <div className="flex justify-around mb-1">
        {level2.map((h, i) => (
          <MerkleNode key={i} label={`h${i * 2}${i * 2 + 1}`} done={doneCount >= (i + 1) * 2} active={doneCount === i * 2 + 1} />
        ))}
      </div>
      <div className="flex justify-around flex-wrap gap-0.5">
        {leaves.map((h, i) => (
          <MerkleNode key={i} label={h || `tx${i}`} done={doneCount > i} active={doneCount === i} />
        ))}
      </div>
    </div>
  );
}

function BlockVerifySection({ verifyState }) {
  if (!verifyState) {
    return <div className="text-muted-dim text-xs text-center py-3">블록 대기 중…</div>;
  }
  const { blockData, steps, merkle } = verifyState;

  return (
    <div className="overflow-y-auto flex-1 min-h-0">
      <div className="text-text-secondary text-xs mb-1.5">
        Block #{blockData?.height?.toLocaleString() ?? '?'}
        {blockData?.pool ? ` · ${blockData.pool}` : ''}
        {blockData?.hash && (
          <span className="text-text-dim ml-1">{blockData.hash.slice(0, 12)}…</span>
        )}
      </div>
      {steps.map((step, i) => (
        <BlockStepRow key={i} step={step} />
      ))}
      <MerkleTree merkle={merkle} />
    </div>
  );
}

// ── 멤풀 Treemap 섹션 ───────────────────────────────────────────────────────

function MempoolSection({ mempoolTxs, mempoolCount, mempoolInfo, onTxClick }) {
  const [hoveredTxid, setHoveredTxid] = useState(null);
  const [pulsingTxids, setPulsingTxids] = useState(new Set());
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 220, h: 120 });
  const prevTxidsRef = useRef(new Set());

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

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

  const rects = useMemo(() => squarify(mempoolTxs, dims.w, dims.h), [mempoolTxs, dims.w, dims.h]);

  const totalVB = useMemo(() => {
    if (mempoolInfo?.vsize) return mempoolInfo.vsize;
    if (mempoolInfo?.bytes) return mempoolInfo.bytes;
    return mempoolTxs.reduce((s, t) => s + (t.weight ? Math.ceil(t.weight / 4) : 140), 0);
  }, [mempoolTxs, mempoolInfo]);

  const totalVBStr = totalVB >= 1e6 ? `${(totalVB / 1e6).toFixed(1)} MvB` : `${totalVB.toLocaleString()} vB`;

  return (
    <div className="flex flex-col min-h-0">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-1 shrink-0">
        <span className="text-mempool-green font-bold text-xs tracking-wide">▸ MEMPOOL</span>
        <span className="text-muted text-label-xs">
          {mempoolCount != null ? `${mempoolCount.toLocaleString()} TX` : '—'}
          {totalVB > 0 && ` · ${totalVBStr}`}
        </span>
      </div>

      {/* Treemap */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden rounded min-h-[80px]">
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
                  x={r.x} y={r.y}
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
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="2" />
                  )}
                </rect>
                {r.w > 35 && r.h > 14 && (
                  <text
                    x={r.x + r.w / 2} y={r.y + r.h / 2 + 3}
                    textAnchor="middle" fill={`${color}99`}
                    fontSize={8} fontFamily="monospace"
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
                        text-label-xs text-text-primary whitespace-nowrap z-[var(--z-hud-float)] pointer-events-none
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

      {/* 범례 */}
      <div className="flex gap-3 mt-1 text-label-xs shrink-0 justify-end">
        <span className="text-[#ef4444]">● 50+ sat/vB</span>
        <span className="text-[#f59e0b]">● 20+</span>
        <span className="text-[#22c55e]">● 10+</span>
        <span className="text-[#60a5fa]">● {'<'}10</span>
      </div>
    </div>
  );
}

// ── 통합 패널 ────────────────────────────────────────────────────────────────

export default function UnifiedPanel({
  txStream,
  blockVerifyState,
  mempoolTxs,
  mempoolCount,
  mempoolInfo,
  showTx,
  showMempool,
  showBlock,
  onTxClick,
}) {
  const [minimized, setMinimized] = useState(false);

  // 모든 섹션이 꺼지면 패널 숨김
  const anyVisible = showTx || showMempool || showBlock;
  if (!anyVisible) return null;

  // 활성 섹션 수 (레이아웃 비율 결정용)
  const topVisible = showTx || showBlock;

  // 요약 텍스트 (최소화 시 표시)
  const txCount = txStream.length;
  const verifyingCount = txStream.filter((t) => t.status === 'verifying').length;
  const poolCount = mempoolTxs.length;

  return (
    <div
      className={`absolute right-4 top-[60px] z-[var(--z-hud)] font-mono
                  bg-panel-bg border border-white/10 rounded-xl
                  backdrop-blur-xl overflow-hidden flex flex-col
                  transition-all duration-300
                  max-sm:right-2 max-sm:left-2 max-sm:w-auto
                  ${minimized ? 'h-[40px]' : ''}`}
      style={{
        width: window.innerWidth < 640 ? undefined : 560,
        height: minimized ? 40 : 'calc(100vh - 160px)',
        maxHeight: minimized ? 40 : 'calc(100vh - 160px)',
      }}
    >
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0 border-b border-dark-border">
        <span className="text-text-primary font-bold text-xs tracking-wide">
          ▸ VERIFICATION CENTER
        </span>
        <div className="flex items-center gap-2">
          {minimized && (
            <span className="text-muted text-label-xs">
              {showTx && `TX ${txCount}건`}
              {showTx && showMempool && ' · '}
              {showMempool && `멤풀 ${poolCount}건`}
            </span>
          )}
          <button
            onClick={() => setMinimized(!minimized)}
            className="text-muted hover:text-text-primary text-xs cursor-pointer px-1"
            title={minimized ? '확장' : '최소화'}
          >
            {minimized ? '▢' : '▁'}
          </button>
        </div>
      </div>

      {/* ── 콘텐츠 (최소화 시 숨김) ── */}
      {!minimized && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 상단: TX검증 + 블록검증 (가로 분할) */}
          {topVisible && (
            <div className={`flex min-h-0 ${showMempool ? 'flex-[55]' : 'flex-1'}`}>
              {/* TX 검증 */}
              {showTx && (
                <div className={`flex flex-col min-h-0 px-3 py-2.5 overflow-hidden
                               ${showBlock ? 'flex-[55] border-r border-dark-border' : 'flex-1'}`}>
                  <div className="text-tx-blue font-bold text-label-sm tracking-wide mb-1 shrink-0 flex justify-between">
                    <span>▸ TX VERIFICATION</span>
                    <span className="text-muted font-normal">{txCount}건 {verifyingCount > 0 && `(⟳${verifyingCount})`}</span>
                  </div>
                  <TxStreamSection txStream={txStream} onTxClick={onTxClick} />
                </div>
              )}

              {/* 블록 검증 */}
              {showBlock && (
                <div className={`flex flex-col min-h-0 px-3 py-2.5 overflow-hidden
                               ${showTx ? 'flex-[45]' : 'flex-1'}`}>
                  <div className="text-block-purple font-bold text-label-sm tracking-wide mb-1 shrink-0">
                    ▸ BLOCK VERIFICATION
                  </div>
                  <BlockVerifySection verifyState={blockVerifyState} />
                </div>
              )}
            </div>
          )}

          {/* 하단: 멤풀 treemap */}
          {showMempool && (
            <div className={`flex flex-col min-h-0 px-3 py-2.5 border-t border-dark-border
                           ${topVisible ? 'flex-[45]' : 'flex-1'}`}>
              <MempoolSection
                mempoolTxs={mempoolTxs}
                mempoolCount={mempoolCount}
                mempoolInfo={mempoolInfo}
                onTxClick={onTxClick}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
