import React from 'react';

/**
 * TxTooltip — BitfeedFloor 호버 시 컴팩트 TX 정보 카드
 *
 * Props:
 *   tx       — { txid, feeRate, size, weight, fee, vin, vout, totalValue }
 *   x, y     — 커서 위치
 */
export default function TxTooltip({ tx, x, y }) {
  if (!tx) return null;

  // viewport 클램핑
  const tooltipW = 280;
  const tooltipH = 160;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = x + 12;
  let top = y + 12;
  if (left + tooltipW > vw - 8) left = x - tooltipW - 12;
  if (top + tooltipH > vh - 8) top = y - tooltipH - 12;
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  const shortTxid = tx.txid
    ? tx.txid.slice(0, 24) + '…'
    : '?';

  const vinCount = tx.vin ?? tx.inputCount ?? '?';
  const voutCount = tx.vout ?? tx.outputCount ?? '?';
  const vbytes = tx.weight ? (tx.weight / 4).toFixed(2) : tx.size ? tx.size : '?';
  const feeRate = tx.feeRate ?? (tx.fee && tx.weight ? (tx.fee / (tx.weight / 4)).toFixed(2) : '?');
  const fee = tx.fee ?? '?';

  // BTC 값 포맷
  let valueStr = null;
  if (tx.totalValue != null) {
    const btc = (tx.totalValue / 1e8).toFixed(8);
    const usd = tx.totalValue / 1e8 * 90000; // 추정 가격
    valueStr = `₿ ${btc}`;
    if (usd >= 1000) valueStr += ` ≈ $${(usd / 1000).toFixed(1)}K`;
    else if (usd >= 1) valueStr += ` ≈ $${usd.toFixed(0)}`;
  }

  return (
    <div
      className="fixed pointer-events-none z-30 panel-base px-3 py-2.5 font-mono text-xs"
      style={{
        left, top, width: tooltipW,
        background: 'rgba(22, 26, 32, 0.95)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex items-center gap-1 mb-1">
        <span className="text-text-secondary text-[11px]">TxID:</span>
        <span className="text-text-primary text-[11px]">{shortTxid}</span>
      </div>
      <div className="text-text-secondary text-[11px] mb-0.5">{vinCount} input → {voutCount} outputs</div>
      <div className="text-text-secondary text-[11px] mb-0.5">Size: {vbytes} vbytes</div>
      <div className="text-text-secondary text-[11px] mb-0.5">Fee rate: {feeRate} sats/vbyte</div>
      <div className="text-text-secondary text-[11px] mb-0.5">Fee: {fee} sats</div>
      {valueStr && (
        <div className="text-btc-orange text-[11px]">Total: {valueStr}</div>
      )}
    </div>
  );
}
