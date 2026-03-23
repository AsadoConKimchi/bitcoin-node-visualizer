import React, { useState, useCallback, useEffect } from 'react';
import MacWindow from './MacWindow.jsx';
import { feeColor } from '../utils/colors.js';

// ── StepProgressBar (6세그먼트 바 + 현재 단계명) ──
function StepProgressBar({ steps }) {
  if (!steps?.length) return null;

  // 현재 활성 단계 찾기
  const activeStep = steps.find(s => s.status === 'active');
  const allDone = steps.every(s => s.status === 'done');
  const hasFail = steps.some(s => s.status === 'fail');

  return (
    <div className="flex flex-col items-end gap-0.5 ml-1 min-w-[120px]">
      {/* 세그먼트 바 */}
      <div className="flex gap-[2px] w-[120px] h-[8px]">
        {steps.map((step, i) => {
          let bg;
          let className = 'flex-1 rounded-sm transition-all duration-300';
          if (step.status === 'done') bg = '#22c55e';
          else if (step.status === 'fail') bg = '#ef4444';
          else if (step.status === 'active') {
            bg = '#f7931a';
            className += ' step-pulse';
          } else {
            bg = '#1e2328';
          }
          return (
            <div
              key={i}
              className={className}
              style={{ backgroundColor: bg }}
              title={step.name}
            />
          );
        })}
      </div>
      {/* 현재 단계명 텍스트 */}
      <div className="text-[9px] font-mono leading-none whitespace-nowrap"
           style={{
             color: hasFail ? '#ef4444' : allDone ? '#22c55e' : '#f7931a',
           }}>
        {hasFail ? '실패' : allDone ? '완료' : activeStep?.name || '대기'}
      </div>
    </div>
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
        className={`flex justify-between py-1 gap-2
                    ${step.status === 'active' ? 'bg-btc-orange/8 rounded px-1 -mx-1' : ''}
                    ${detail ? 'cursor-pointer hover:bg-white/5 rounded px-1 -mx-1' : ''}`}
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
  const [detailTx, setDetailTx] = useState(null);

  // TX 스냅샷 복사본 — txStream에서 제거되어도 패널 유지
  useEffect(() => {
    if (!expandedTxid) { setDetailTx(null); return; }
    const found = txStream.find(t => t.txid === expandedTxid);
    if (found?.verifySnapshot) {
      setDetailTx({
        ...found,
        verifySnapshot: { ...found.verifySnapshot, steps: [...found.verifySnapshot.steps] },
      });
    }
    // found === undefined (TX 제거됨) → detailTx 유지
  }, [expandedTxid, txStream]);

  const handleClick = useCallback((txid) => {
    setExpandedTxid((prev) => prev === txid ? null : txid);
  }, []);

  if (!visible) return null;

  const txCount = txStream.length;
  const verifyingCount = txStream.filter((t) => t.status === 'verifying').length;
  const failedCount = txStream.filter((t) => t.status === 'failed').length;
  const doneCount = txStream.filter((t) => t.status === 'done' || t.status === 'animating').length;

  return (
    <>
      <MacWindow
        title="TX VERIFICATION"
        titleColor="text-tx-blue"
        initialPosition={{ x: 16, y: 56 }}
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
                  {/* Line 1: icon + txid + step progress bar */}
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
                    <span className="ml-auto">
                      {isFailed ? (
                        <span className="text-error text-[11px]">반려</span>
                      ) : isAnimating ? (
                        <span className="text-mempool-green text-[11px]">→ 멤풀</span>
                      ) : snap?.steps ? (
                        <StepProgressBar steps={snap.steps} />
                      ) : (
                        <span className="text-text-dim text-[11px]">검증중</span>
                      )}
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

      {/* 사이드 검증 상세 패널 */}
      {detailTx?.verifySnapshot && (
        <div
          className="fixed bg-panel-bg border border-tx-blue/20 rounded-xl
                     backdrop-blur-[20px] w-[280px] max-h-[45vh] overflow-y-auto
                     px-3.5 py-3 z-[15]"
          style={{
            left: 344,
            top: 56,
            boxShadow: 'var(--shadow-panel-layered)',
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="text-tx-blue font-bold text-[11px] tracking-wide">
              ▸ TX 검증 상세
              {detailTx.verifySnapshot.done && detailTx.status !== 'failed' && (
                <span className="text-success ml-1">완료 ✓</span>
              )}
              {detailTx.status === 'failed' && (
                <span className="text-error ml-1">실패 ✗</span>
              )}
            </div>
            <button
              onClick={() => setExpandedTxid(null)}
              className="text-muted hover:text-text-primary text-xs cursor-pointer
                         bg-transparent border-none"
            >
              ✕
            </button>
          </div>

          {/* TXID */}
          <div className="text-text-dim text-[11px] font-mono mb-1.5 truncate" title={detailTx.txid}>
            {detailTx.txid}
          </div>

          {/* 크기 정보 */}
          {(detailTx.verifySnapshot.size != null || detailTx.verifySnapshot.weight != null) && (
            <div className="text-btc-orange/50 text-[11px] mb-2">
              {detailTx.verifySnapshot.size != null && `${detailTx.verifySnapshot.size} B`}
              {detailTx.verifySnapshot.size != null && detailTx.verifySnapshot.weight != null && ' · '}
              {detailTx.verifySnapshot.weight != null && `${detailTx.verifySnapshot.weight} WU`}
            </div>
          )}

          {detailTx.verifySnapshot.short && (
            <div className="text-muted text-[11px] mb-2">{detailTx.verifySnapshot.short}</div>
          )}

          {/* 검증 단계 */}
          {detailTx.verifySnapshot.steps.map((step, i) => (
            <InlineStepRow key={i} step={step} />
          ))}
        </div>
      )}
    </>
  );
}
