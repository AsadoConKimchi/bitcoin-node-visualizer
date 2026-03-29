import React, { useState } from 'react';

// 교육 다이어그램 3단계
const EDU_STEPS = [
  {
    title: '① Headers-first 동기화',
    desc: '노드가 먼저 80바이트 블록 헤더만 다운로드합니다. 전체 블록보다 수천 배 가벼워 빠르게 체인 구조를 파악합니다.',
    color: '#f7931a',
    detail: '헤더 체인을 검증하여 가장 많은 PoW를 가진 체인을 식별합니다.',
  },
  {
    title: '② 병렬 블록 다운로드',
    desc: '여러 피어에게 동시에 블록을 요청하여 대역폭을 극대화합니다. 각 피어에서 서로 다른 블록 범위를 받습니다.',
    color: '#93c5fd',
    detail: '피어당 16개 블록을 동시 요청 (MAX_BLOCKS_IN_TRANSIT_PER_PEER).',
  },
  {
    title: '③ 순차 검증',
    desc: '다운로드된 블록을 높이 순서대로 검증합니다. 각 블록의 TX, PoW, Merkle root, Coinbase를 모두 확인합니다.',
    color: '#a78bfa',
    detail: 'assumevalid 체크포인트까지는 서명 검증을 건너뛰어 속도를 높입니다.',
  },
];

function SectionTitle({ children }) {
  return (
    <div className="text-text-secondary text-label-sm tracking-wide mt-2.5 mb-1">
      {children}
    </div>
  );
}

function DiagramBox({ children, border = 'border-muted-dim' }) {
  return (
    <div className={`bg-dark-surface border ${border} rounded px-2.5 py-2 mb-1.5 text-xs leading-relaxed`}>
      {children}
    </div>
  );
}

function ProgressBar({ ratio, color, label, sublabel }) {
  return (
    <div>
      <div className="flex justify-between text-label-xs mb-0.5">
        <span className="text-text-secondary">{label}</span>
        <span style={{ color }}>{sublabel}</span>
      </div>
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000"
             style={{ width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// 교육 모드 (동기화 완료 또는 Vercel)
function IBDEducation() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div>
      <SectionTitle>▸ IBD (Initial Block Download)</SectionTitle>
      <DiagramBox border="border-btc-orange/25">
        <div className="text-btc-orange text-label-xs">
          새 노드가 처음 시작하면 2009년 제네시스 블록부터 현재까지의
          모든 블록을 다운로드하고 검증해야 합니다. 이 과정을 IBD라 합니다.
        </div>
      </DiagramBox>

      {/* 3단계 인터랙티브 다이어그램 */}
      <SectionTitle>▸ IBD 3단계 프로세스</SectionTitle>
      <div className="space-y-1 mb-2">
        {EDU_STEPS.map((step, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`w-full text-left rounded px-2.5 py-2 border transition-colors cursor-pointer
                       ${activeStep === i
                         ? 'bg-white/8 border-white/15'
                         : 'bg-dark-surface border-transparent hover:bg-white/5'}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-label-xs font-bold shrink-0"
                    style={{ backgroundColor: step.color + '25', color: step.color }}>
                {i + 1}
              </span>
              <span className="text-xs font-medium text-text-primary">{step.title}</span>
            </div>
            {activeStep === i && (
              <div className="mt-1.5 ml-7">
                <div className="text-label-xs text-text-secondary leading-relaxed">{step.desc}</div>
                <div className="text-label-xs text-text-dim mt-1">{step.detail}</div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 시간 추정 */}
      <DiagramBox border="border-muted-dim">
        <div className="text-label-xs text-text-secondary">
          <div>소요 시간 (하드웨어별 추정):</div>
          <div className="flex justify-between mt-1">
            <span className="text-text-dim">고성능 PC (NVMe SSD)</span>
            <span>~6시간</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Raspberry Pi 4 (SSD)</span>
            <span>~3~7일</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">Raspberry Pi 4 (HDD)</span>
            <span>~2~4주</span>
          </div>
        </div>
      </DiagramBox>
    </div>
  );
}

// 라이브 IBD 진행 상태 (서버 모드, IBD 중)
function IBDLive({ ibdStatus }) {
  const { headers, blocks, verificationProgress, sizeOnDisk } = ibdStatus;
  const headerRatio = headers > 0 ? 1 : 0; // 헤더는 보통 먼저 완료
  const blockRatio = headers > 0 ? blocks / headers : 0;
  const verifyPct = (verificationProgress * 100).toFixed(2);
  const sizeGB = sizeOnDisk ? (sizeOnDisk / 1e9).toFixed(1) : '—';

  return (
    <div>
      <SectionTitle>▸ IBD 진행 중</SectionTitle>
      <DiagramBox border="border-btc-orange/25">
        <div className="text-center mb-2">
          <span className="text-2xl font-bold text-btc-orange">{verifyPct}%</span>
          <span className="text-text-dim text-label-xs ml-1">검증 완료</span>
        </div>

        <div className="space-y-2.5">
          <ProgressBar
            ratio={headerRatio}
            color="#f7931a"
            label="① 헤더 다운로드"
            sublabel={`${headers?.toLocaleString() || 0} 헤더`}
          />
          <ProgressBar
            ratio={blockRatio}
            color="#93c5fd"
            label="② 블록 다운로드"
            sublabel={`${blocks?.toLocaleString() || 0} / ${headers?.toLocaleString() || 0}`}
          />
          <ProgressBar
            ratio={verificationProgress}
            color="#a78bfa"
            label="③ 검증 진행률"
            sublabel={`${verifyPct}%`}
          />
        </div>

        <div className="flex justify-between text-label-xs mt-2 pt-2 border-t border-white/5">
          <span className="text-text-dim">디스크 사용량</span>
          <span className="text-text-secondary">{sizeGB} GB</span>
        </div>
      </DiagramBox>
    </div>
  );
}

export default function IBDPanel({ ibdStatus, sourceType, blockHeight }) {
  const isServer = sourceType === 'server';
  const isIBD = ibdStatus?.isIBD === true;

  // 서버 모드 + IBD 진행 중 → 라이브 진행률 표시
  if (isServer && isIBD && ibdStatus) {
    return (
      <div className="px-3.5 py-2.5 font-mono text-sm text-text-primary">
        <IBDLive ibdStatus={ibdStatus} />
        <div className="mt-2 border-t border-white/5 pt-2">
          <IBDEducation />
        </div>
      </div>
    );
  }

  // 동기화 완료 또는 Vercel 모드 → 교육 다이어그램
  return (
    <div className="px-3.5 py-2.5 font-mono text-sm text-text-primary">
      <IBDEducation />
      {isServer && ibdStatus?.verificationProgress != null && (
        <div className="mt-1 text-center text-label-xs py-1 bg-success/10 text-success rounded">
          IBD 완료 — 동기화 100%
        </div>
      )}
      {!isServer && (
        <div className="mt-1 text-center text-label-xs py-1 bg-btc-orange/10 text-btc-orange rounded">
          교육 모드 — 풀노드 연결 시 실제 IBD 진행률 표시
        </div>
      )}
    </div>
  );
}
