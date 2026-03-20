/**
 * 수수료율 기반 색상 유틸리티 — 6단계 그라데이션
 */
export function feeColor(feeRate) {
  if (feeRate >= 50) return '#ef4444';  // 매우 높은: 빨강
  if (feeRate >= 20) return '#f59e0b';  // 높은: 주황
  if (feeRate >= 10) return '#eab308';  // 중간: 노랑-초록
  if (feeRate >= 5)  return '#22c55e';  // 보통: 초록
  if (feeRate >= 2)  return '#2dd4bf';  // 낮은: 시안
  return '#60a5fa';                     // 최저: 파랑
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
  { label: '50+', color: '#ef4444' },
  { label: '20+', color: '#f59e0b' },
  { label: '10+', color: '#eab308' },
  { label: '5+',  color: '#22c55e' },
  { label: '2+',  color: '#2dd4bf' },
  { label: '<2',  color: '#60a5fa' },
];
