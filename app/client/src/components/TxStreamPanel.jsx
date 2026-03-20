import React, { useState, useCallback } from 'react';
import MacWindow from './MacWindow.jsx';
import { feeColor } from '../utils/colors.js';

// ── MiniProgress (6단계 도트) ──
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

// ── TX 검증 단계 상세 ──
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
          {detail && <span className="text-muted ml-1 text-[11px]">{expanded ? '▾' : '▸'}</span>}
        </span>
        <span className="text-muted text-[11px]">{step.detail}</span>
      </div>
      {expanded && detail && (
        <div className="text-[11px] text-muted ml-5 mr-1 mb-1 leading-relaxed bg-dark-surface/50 rounded px-2 py-1.5">
          {detail}
        </div>
      )}
    </div>
  );
}

export default function TxStreamPanel({
  txStream,
  onTxClick,
  visible,
  minimized,
  onClose,
  onMinimize,
  zIndex,
  onFocus,
}) {
  const [expandedTxid, setExpandedTxid] = useState(null);

  const handleClick = useCallback((txid) => {
    setExpandedTxid((prev) => prev === txid ? null : txid);
  }, []);

  if (!visible) return null;

  const txCount = txStream.length;
  const verifyingCount = txStream.filter((t) => t.status === 'verifying').length;
  const failedCount = txStream.filter((t) => t.status === 'failed').length;
  const doneCount = txStream.filter((t) => t.status === 'done' || t.status === 'animating').length;

  return (
    <MacWindow
      title="TX VERIFICATION"
      titleColor="text-tx-blue"
      initialPosition={{ x: typeof window !== 'undefined' ? window.innerWidth - 340 : 800, y: 56 }}
      onClose={onClose}
      onMinimize={onMinimize}
      minimized={minimized}
      zIndex={zIndex}
      onFocus={onFocus}
      width={320}
      height="45vh"
      headerRight={
        <span className="text-muted text-[11px] font-mono">
          {txCount}건
          {verifyingCount > 0 && ` ⟳${verifyingCount}`}
          {failedCount > 0 && <span className="text-error ml-1">✗{failedCount}</span>}
        </span>
      }
    >
      {/* TX 리스트 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1">
        {txStream.length === 0 && (
          <div className="text-muted-dim text-sm text-center py-4">TX 대기 중…</div>
        )}

        {txStream.map((tx) => {
          const isDone = tx.status === 'done' || tx.status === 'animating';
          const isFailed = tx.status === 'failed';
          const isAnimating = tx.status === 'animating';
          const isExpanded = expandedTxid === tx.txid;
          const short = tx.txid ? tx.txid.slice(0, 10) + '…' : '?';

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
                    <span className="text-error text-[11px] ml-1">{tx.failReason}</span>
                  )}
                  <span className="ml-auto text-text-dim text-[11px] flex items-center">
                    {isFailed ? '반려' : isAnimating ? '→ 멤풀' : snap?.steps
                      ? <MiniProgress steps={snap.steps} />
                      : '검증중'}
                  </span>
                </div>
                {/* Line 2: feeRate · size/weight · vin→vout · 상세보기 */}
                <div className="flex items-center gap-1.5 ml-6 mt-0.5 text-[11px] font-mono">
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
                  {onTxClick && (
                    <span
                      className="ml-auto text-muted hover:text-tx-blue cursor-pointer transition-colors"
                      title="TX 상세보기"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTxClick({ txid: tx.txid, data: tx.data || {} });
                      }}
                    >
                      🔍
                    </span>
                  )}
                </div>
              </div>

              {/* 인라인 검증 상세 */}
              {isExpanded && tx.verifySnapshot && (
                <div className="ml-3 mr-1 my-1.5 px-3 py-2 bg-dark-surface/60 border border-tx-blue/20 rounded">
                  <div className="text-tx-blue font-bold text-[11px] tracking-wide mb-1.5">
                    ▸ TX 검증 {tx.verifySnapshot.done && !isFailed && <span className="text-success">완료 ✓</span>}
                    {isFailed && <span className="text-error">실패 ✗</span>}
                  </div>
                  {tx.verifySnapshot.short && (
                    <div className="text-muted text-[11px] mb-1">{tx.verifySnapshot.short}</div>
                  )}
                  {(tx.verifySnapshot.size != null || tx.verifySnapshot.weight != null) && (
                    <div className="text-btc-orange/30 text-[11px] mb-1.5">
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
                       text-mempool-green text-[11px] text-center">
          → Mempool: {doneCount}건 이동 중
        </div>
      )}
    </MacWindow>
  );
}
