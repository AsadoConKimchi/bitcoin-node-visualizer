/**
 * 파티클 물리 상태 관리
 * - TX 버블: 피어 → 중심 노드 이동
 * - 블록 패킷: 중심 노드 → 모든 피어 이동 (전파)
 */

let _nextId = 0;

/**
 * TX 버블 생성
 * @param {{ x:number, y:number }} from  출발 피어 위치
 * @param {{ x:number, y:number }} to    중심 노드 위치
 * @param {string} txid
 * @returns {object} 파티클 객체
 */
export function createTxParticle(from, to, txid = '') {
  return {
    id: _nextId++,
    kind: 'tx',
    txid,
    x: from.x,
    y: from.y,
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    progress: 0,      // 0 → 1
    speed: 0.012 + Math.random() * 0.008,
    radius: 4 + Math.random() * 3,
    alpha: 1,
    done: false,
  };
}

/**
 * 블록 패킷 생성 (한 목적지당 1개)
 * @param {{ x:number, y:number }} from  중심 노드 위치
 * @param {{ x:number, y:number }} to    목적 피어 위치
 * @param {object} blockInfo
 * @returns {object} 파티클 객체
 */
export function createBlockParticle(from, to, blockInfo = {}) {
  return {
    id: _nextId++,
    kind: 'block',
    blockInfo,
    x: from.x,
    y: from.y,
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    progress: 0,
    speed: 0.018 + Math.random() * 0.006,
    radius: 8,
    alpha: 1,
    done: false,
    validated: blockInfo.merkleOk !== false,
  };
}

/**
 * 모든 활성 파티클 업데이트 (매 프레임)
 * @param {object[]} particles
 * @returns {object[]} 완료되지 않은 파티클 목록
 */
export function updateParticles(particles) {
  for (const p of particles) {
    if (p.done) continue;
    p.progress = Math.min(1, p.progress + p.speed);

    // ease-in-out 보간
    const t = easeInOut(p.progress);
    p.x = lerp(p.fromX, p.toX, t);
    p.y = lerp(p.fromY, p.toY, t);

    // 도착 직전 페이드 아웃
    if (p.progress > 0.85) {
      p.alpha = 1 - (p.progress - 0.85) / 0.15;
    }

    if (p.progress >= 1) {
      p.done = true;
    }
  }

  // 완료 파티클 제거 (최대 500개 제한)
  const active = particles.filter((p) => !p.done);
  return active.length > 500 ? active.slice(-500) : active;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
