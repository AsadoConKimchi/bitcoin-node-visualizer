/**
 * 수수료율 기반 색상 유틸리티 — 6단계 그라데이션
 */

// fee 색상 상수 (theme tokens와 동기화)
export const FEE_COLORS = {
  highest: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  normal: '#22c55e',
  low: '#2dd4bf',
  lowest: '#60a5fa',
};

export function feeColor(feeRate) {
  if (feeRate >= 50) return FEE_COLORS.highest;  // 매우 높은: 빨강
  if (feeRate >= 20) return FEE_COLORS.high;      // 높은: 주황
  if (feeRate >= 10) return FEE_COLORS.medium;    // 중간: 노랑-초록
  if (feeRate >= 5)  return FEE_COLORS.normal;    // 보통: 초록
  if (feeRate >= 2)  return FEE_COLORS.low;       // 낮은: 시안
  return FEE_COLORS.lowest;                       // 최저: 파랑
}

export function feeGlow(feeRate) {
  if (feeRate >= 50) return 'rgba(239,68,68,0.4)';
  if (feeRate >= 20) return 'rgba(245,158,11,0.4)';
  if (feeRate >= 10) return 'rgba(234,179,8,0.3)';
  if (feeRate >= 5)  return 'rgba(34,197,94,0.3)';
  if (feeRate >= 2)  return 'rgba(45,212,191,0.3)';
  return 'rgba(96,165,250,0.3)';
}

export const FEE_LEGEND = [
  { label: '50+', color: FEE_COLORS.highest },
  { label: '20+', color: FEE_COLORS.high },
  { label: '10+', color: FEE_COLORS.medium },
  { label: '5+',  color: FEE_COLORS.normal },
  { label: '2+',  color: FEE_COLORS.low },
  { label: '<2',  color: FEE_COLORS.lowest },
];
