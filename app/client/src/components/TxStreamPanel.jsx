import React, { useState, useRef, useCallback } from 'react';

const STATUS_ICON = {
  done: { icon: '✓', color: 'text-success' },
  active: { icon: '⟳', color: 'text-warning' },
  waiting: { icon: '–', color: 'text-muted-dim' },
};

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

// TX 검증 단계 상세 설명
const TX_STEP_DETAILS = {
  '구문 파싱': 'TX 데이터 구조(버전, vin/vout 배열, locktime)가 프로토콜 규격에 맞는지 파싱합니다.',
  'IsStandard 검사': 'TX가 표준 스크립트 유형(P2PKH, P2SH, P2WPKH, P2WSH, P2TR)을 사용하는지 확인합니다. 비표준 TX는 전파되지 않습니다.',
  'UTXO 조회': '각 입력이 참조하는 UTXO가 UTXO 세트에 실제로 존재하는지, 아직 소비되지 않았는지 확인합니다.',
  '이중 지불 검사': '같은 UTXO를 소비하는 다른 TX가 멤풀에 이미 존재하지 않는지 확인합니다.',
  '서명 검증': 'secp256k1 타원곡선 위에서 각 입력의 디지털 서명을 검증합니다. 서명이 유효해야 UTXO를 소비할 수 있습니다.',
  '금액 합산': '입력 합계 ≥ 출력 합계인지 확인합니다. 차이(입력 - 출력)가 채굴자 수수료가 됩니다.',
};

function InlineStepRow({ step }) {
  const { icon, color } = STATUS_ICON[step.status] || STATUS_ICON.waiting;
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
          {detail && <span className="text-muted ml-0.5 text-[9px]">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className="text-muted text-[9px]">{step.detail}</span>
      </div>
      {expanded && detail && (
        <div className="text-[9px] text-muted ml-4 mr-0.5 mb-0.5 leading-relaxed bg-dark-surface/50 rounded px-1.5 py-1">
          {detail}
        </div>
      )}
    </div>
  );
}

export default function TxStreamPanel({ txStream, compact }) {
  const [hoveredTxid, setHoveredTxid] = useState(null);
  const [expandedTxid, setExpandedTxid] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0 });
  const panelRef = useRef(null);

  const hoveredTx = txStream.find((t) => t.txid === hoveredTxid);

  const handleMouseEnter = useCallback((txid, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const panelRect = panelRef.current?.getBoundingClientRect();
    setHoveredTxid(txid);
    setTooltipPos({ top: rect.top - (panelRect?.top || 0) });
  }, []);

  const handleTxClick = useCallback((txid) => {
    setExpandedTxid((prev) => prev === txid ? null : txid);
  }, []);

  // 멤풀 이동 카운트 (done + animating)
  const doneCount = txStream.filter((t) => t.status === 'done' || t.status === 'animating').length;

  // HUD가 컴팩트 모드면 top-[100px], 아니면 top-[220px]
  const topClass = compact ? 'top-[100px]' : 'top-[220px]';
  const heightCalc = compact ? 'calc(100vh - 390px)' : 'calc(100vh - 510px)';

  return (
    <div
      ref={panelRef}
      className={`absolute ${topClass} left-4 w-[240px]
                 overflow-hidden bg-panel-bg border border-white/10
                 rounded-xl font-mono text-sm text-text-primary
                 backdrop-blur-[20px] z-10 flex flex-col
                 max-sm:left-2 max-sm:w-[190px] max-sm:text-xs`}
      style={{ height: heightCalc, maxHeight: heightCalc }}
    >
      {/* 헤더 (고정) */}
      <div className="px-3 py-2.5 shrink-0 border-b border-white/6">
        <div className="text-tx-blue font-bold text-xs tracking-wide flex justify-between">
          <span>▸ TX STREAM</span>
          <span className="text-muted font-normal">{txStream.length}건</span>
        </div>
      </div>

      {/* TX 리스트 (스크롤) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1">
        {txStream.length === 0 && (
          <div className="text-muted-dim text-xs text-center py-4">TX 대기 중…</div>
        )}

        {txStream.map((tx) => {
          const isDone = tx.status === 'done' || tx.status === 'animating';
          const isAnimating = tx.status === 'animating';
          const isExpanded = expandedTxid === tx.txid;
          const short = tx.txid ? tx.txid.slice(0, 8) + '…' : '?';

          return (
            <div key={tx.txid}>
              <div
                onMouseEnter={(e) => handleMouseEnter(tx.txid, e)}
                onMouseLeave={() => setHoveredTxid(null)}
                onClick={() => handleTxClick(tx.txid)}
                className={`flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer
                           transition-all duration-500
                           ${isExpanded ? 'bg-tx-blue/10' : hoveredTxid === tx.txid ? 'bg-tx-blue/5' : ''}
                           ${isAnimating ? 'shadow-[0_0_12px_rgba(34,197,94,0.3)]' : ''}`}
                style={{
                  opacity: isAnimating ? 0 : 1,
                  transform: isAnimating ? 'translateY(20px)' : 'translateY(0)',
                }}
              >
                <span className={`text-xs min-w-[12px] ${isDone ? 'text-success' : 'text-warning'}`}>
                  {isDone ? '✓' : '⟳'}
                </span>
                <span className={`text-xs font-mono ${isDone ? 'text-success/70' : 'text-text-primary'}`}>
                  {short}
                </span>
                <span className="ml-auto text-text-dim text-[9px] flex items-center">
                  {isAnimating ? '→ 멤풀' : tx.verifySnapshot?.steps
                    ? <MiniProgress steps={tx.verifySnapshot.steps} />
                    : '검증중'}
                </span>
              </div>

              {/* 클릭 시 인라인 검증 상세 */}
              {isExpanded && tx.verifySnapshot && (
                <div className="ml-2 mr-0.5 my-1 px-2 py-1.5 bg-dark-surface/60 border border-tx-blue/20 rounded">
                  <div className="text-tx-blue font-bold text-[9px] tracking-wide mb-1">
                    ▸ TX 검증 {tx.verifySnapshot.done && <span className="text-success">완료 ✓</span>}
                  </div>
                  {tx.verifySnapshot.short && (
                    <div className="text-muted text-[9px] mb-0.5">{tx.verifySnapshot.short}</div>
                  )}
                  {(tx.verifySnapshot.size != null || tx.verifySnapshot.weight != null) && (
                    <div className="text-btc-orange/30 text-[9px] mb-1">
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

      {/* 푸터 (멤풀 이동 카운터) */}
      {doneCount > 0 && (
        <div className="px-3 py-1.5 shrink-0 border-t border-white/6
                       text-mempool-green text-[10px] text-center">
          → Mempool: {doneCount}건 이동 중
        </div>
      )}

      {/* 호버 검증 툴팁 (인라인 펼침과 별도로 유지) */}
      {hoveredTx && hoveredTx.verifySnapshot && expandedTxid !== hoveredTx.txid && (
        <div
          className="absolute left-full ml-2 w-[260px] bg-panel-bg-solid border border-white/10
                     rounded-xl px-3 py-2.5 font-mono text-xs text-text-primary z-11
                     pointer-events-none"
          style={{ boxShadow: 'var(--shadow-panel-layered)' }}
          style={{ top: Math.max(0, tooltipPos.top - 10) }}
        >
          <div className="text-tx-blue font-bold text-[9px] tracking-wide mb-1">
            ▸ TX 검증 {hoveredTx.verifySnapshot.done && <span className="text-success">완료 ✓</span>}
          </div>
          <div className="text-muted text-[9px] mb-0.5">
            {hoveredTx.verifySnapshot.short || '—'}
          </div>
          {(hoveredTx.verifySnapshot.size != null || hoveredTx.verifySnapshot.weight != null) && (
            <div className="text-btc-orange/30 text-[9px] mb-1.5">
              {hoveredTx.verifySnapshot.size != null && `${hoveredTx.verifySnapshot.size} B`}
              {hoveredTx.verifySnapshot.size != null && hoveredTx.verifySnapshot.weight != null && ' · '}
              {hoveredTx.verifySnapshot.weight != null && `${hoveredTx.verifySnapshot.weight} WU`}
            </div>
          )}
          {hoveredTx.verifySnapshot.steps.map((step, i) => (
            <InlineStepRow key={i} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}
