/**
 * 수수료율 기반 색상 유틸리티
 */
export function feeColor(feeRate) {
  if (feeRate >= 50) return '#ef4444';
  if (feeRate >= 20) return '#f59e0b';
  if (feeRate >= 10) return '#34d399';
  return '#60a5fa';
}
