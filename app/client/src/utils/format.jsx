import React, { useState } from 'react';

/**
 * 상대 시간 표시: "3 hours ago", "방금 전"
 */
export function relativeTime(unixTimestamp) {
  if (!unixTimestamp) return '—';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTimestamp;

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * 블록 보상 계산 (sats)
 */
export function calculateSubsidy(height) {
  if (height == null || height < 0) return 0;
  const halvings = Math.floor(height / 210000);
  if (halvings >= 64) return 0;
  return Math.floor(50 * 1e8 / Math.pow(2, halvings));
}

/**
 * BTC 포맷 (sats → BTC 문자열)
 */
export function formatBtc(sats) {
  if (sats == null) return '?';
  return (sats / 1e8).toFixed(8);
}

/**
 * 주소 축약
 */
export function shortAddr(addr) {
  if (!addr) return '???';
  if (addr.length <= 16) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

/**
 * 클립보드 복사 버튼
 */
export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="text-muted hover:text-text-primary text-label cursor-pointer
                 bg-transparent border-none px-1 transition-colors shrink-0"
      title="복사"
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

/**
 * TX Feature 감지 (SegWit, Taproot, RBF)
 */
export function detectTxFeatures(vin, vout) {
  const features = [];

  const hasSegwit = vin?.some(v => v.witness?.length > 0) ||
    vout?.some(v => ['v0_p2wpkh', 'v0_p2wsh'].includes(v.scriptpubkey_type));
  const hasTaproot = vin?.some(v => v.prevout?.scriptpubkey_type === 'v1_p2tr') ||
    vout?.some(v => v.scriptpubkey_type === 'v1_p2tr');
  const hasRbf = vin?.some(v => v.sequence != null && v.sequence < 0xfffffffe);

  if (hasTaproot) features.push({ label: 'Taproot', color: '#a78bfa' });
  else if (hasSegwit) features.push({ label: 'SegWit', color: '#60a5fa' });

  if (hasRbf) features.push({ label: 'RBF', color: '#f59e0b' });

  // OP_RETURN 감지
  if (vout?.some(v => v.scriptpubkey_type === 'op_return')) {
    features.push({ label: 'OP_RETURN', color: '#94a3b8' });
  }

  // Multisig 감지
  const multisig = vout?.find(v => v.scriptpubkey_type === 'multisig');
  if (multisig) features.push({ label: 'Multisig', color: '#2dd4bf' });

  return features;
}

/**
 * 스크립트 타입 표시
 */
export function scriptTypeLabel(type) {
  const labels = {
    'v0_p2wpkh': 'P2WPKH (SegWit)',
    'v0_p2wsh': 'P2WSH (SegWit)',
    'v1_p2tr': 'P2TR (Taproot)',
    'p2pkh': 'P2PKH (Legacy)',
    'p2sh': 'P2SH',
    'op_return': 'OP_RETURN',
    'multisig': 'Multisig',
  };
  return labels[type] || type || '?';
}
