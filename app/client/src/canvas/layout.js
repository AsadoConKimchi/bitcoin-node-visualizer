/**
 * 레이아웃 상수 — 피어 위치, 패널 위치, 색상 팔레트
 */

export const COLORS = {
  background: '#000000',
  star: 'rgba(255,255,255,0.7)',
  // 노드 (우리 Bitcoin Core)
  node: '#f7931a',
  nodePulse: 'rgba(247,147,26,0.3)',
  // 피어
  peer: '#3b82f6',
  peerInactive: '#1e3a5f',
  // TX 버블
  txFill: 'rgba(247,147,26,0.6)',
  txStroke: '#f7931a',
  // 블록 패킷
  blockFill: 'rgba(34,197,94,0.5)',
  blockStroke: '#22c55e',
  blockValidated: '#86efac',
  // HUD 패널
  hudBg: 'rgba(0,0,0,0.75)',
  hudBorder: '#f7931a',
  hudText: '#f7931a',
  hudDim: '#a16207',
  // 상태 도트
  dotGreen: '#22c55e',
  dotOrange: '#f97316',
  dotRed: '#ef4444',
};

/**
 * 캔버스 크기 기준으로 중심 노드 위치 반환
 * @param {number} w
 * @param {number} h
 */
export function getNodeCenter(w, h) {
  return { x: w / 2, y: h / 2 };
}

/**
 * 피어를 노드 주변에 원형 배치
 * @param {number} count   피어 수
 * @param {number} cx      중심 x
 * @param {number} cy      중심 y
 * @param {number} radius  반지름
 * @returns {{ x: number, y: number }[]}
 */
export function getPeerPositions(count, cx, cy, radius) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return positions;
}

/**
 * HUD 패널 영역 반환
 * @param {number} w 캔버스 너비
 * @param {number} h 캔버스 높이
 */
export function getHudLayout(w, h) {
  const pad = 16;
  const panelW = 220;
  const panelH = 180;
  return {
    // 좌상단 패널 (노드 정보)
    nodePanel: { x: pad, y: pad, w: panelW, h: panelH },
    // 우상단 패널 (연결 상태)
    statusPanel: { x: w - panelW - pad, y: pad, w: panelW, h: 120 },
    // 좌하단 패널 (최근 블록)
    blockPanel: { x: pad, y: h - 200 - pad, w: panelW, h: 200 },
  };
}
