import React, { useState } from 'react';

const STATUS_ICON = {
  done: { icon: '✓', color: 'text-success' },
  active: { icon: '⟳', color: 'text-warning' },
  waiting: { icon: '–', color: 'text-muted-dim' },
  fail: { icon: '✗', color: 'text-error' },
};

// 각 단계별 상세 설명
const STEP_DETAILS = {
  'Header Parsing': '블록 헤더(80바이트)를 파싱합니다. 버전, 이전 블록 해시, 머클 루트, 타임스탬프, 난이도 타겟, 논스를 추출합니다.',
  'PoW Validation': '블록 해시가 현재 난이도 타겟보다 작은지 검증합니다. SHA-256d(헤더) < target이면 유효한 작업증명입니다.',
  'Timestamp Validation': '타임스탬프가 MTP(최근 11블록 중앙값)보다 크고, 현재 시간 + 2시간보다 작은지 검증합니다.',
  'Coinbase Validation': '코인베이스 TX의 보상이 블록 보조금 + 수수료 합계를 초과하지 않는지 검증합니다.',
  'Merkle Root': '블록 내 모든 TX의 해시를 이진 트리로 결합하여 계산한 머클 루트가 헤더의 값과 일치하는지 검증합니다.',
  'TX Verification': '블록 내 모든 트랜잭션의 서명, 스크립트, 입출력을 개별 검증합니다.',
  'Weight Check': '블록의 총 weight가 4,000,000 WU(1MB vsize 상당) 이하인지 검증합니다.',
};

function StepRow({ step }) {
  const { icon, color } = STATUS_ICON[step.status] || STATUS_ICON.waiting;
  const [expanded, setExpanded] = useState(false);
  const detail = STEP_DETAILS[step.name];

  return (
    <div>
      <div
        className={`flex justify-between py-1 gap-2 ${detail ? 'cursor-pointer hover:bg-white/5 rounded px-1 -mx-1' : ''}`}
        onClick={() => detail && setExpanded(!expanded)}
      >
        <span className={`${color} min-w-[14px] text-sm`}>{icon}</span>
        <span className={`flex-1 text-sm ${step.status === 'waiting' ? 'text-text-dim' : 'text-text-primary'}`}>
          {step.name}
          {detail && <span className="text-muted ml-1 text-xs">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className="text-muted text-xs">{step.detail}</span>
      </div>
      {expanded && detail && (
        <div className="text-xs text-muted ml-5 mr-1 mb-1 leading-relaxed bg-dark-surface/50 rounded px-2 py-1.5">
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
                    text-[9px] px-1 py-0.5 text-center min-w-[32px] font-mono`}>
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

export default function BlockVerifyPanel({ verifyState }) {
  if (!verifyState) return null;
  const { blockData, steps, merkle } = verifyState;

  return (
    <div className="absolute top-16 right-4 w-[300px] bg-panel-bg border border-white/10
                    rounded-xl px-3.5 py-3 font-mono text-sm text-text-primary
                    backdrop-blur-[20px] z-10 panel-transition
                    max-sm:right-2 max-sm:w-[260px] max-sm:text-xs"
         style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
      {/* 헤더 */}
      <div className="text-block-purple font-bold text-xs tracking-wide mb-2">
        ▸ 블록 검증
      </div>
      <div className="text-text-secondary text-xs mb-2">
        Block #{blockData?.height?.toLocaleString() ?? '?'}
        {blockData?.pool ? ` · ${blockData.pool}` : ''}
        {blockData?.hash && (
          <span className="text-text-dim ml-1">{blockData.hash.slice(0, 12)}…</span>
        )}
      </div>

      {steps.map((step, i) => (
        <StepRow key={i} step={step} />
      ))}

      <MerkleTree merkle={merkle} />
    </div>
  );
}
