/**
 * Canvas 렌더링 함수
 * - 별 배경, 피어, 파티클, 중심 노드, HUD 패널
 */

import { COLORS, getHudLayout } from './layout.js';

// ── 별 배경 ───────────────────────────────────────────────────────────────────

let _stars = null;

function initStars(w, h, count = 200) {
  _stars = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.2 + 0.3,
    alpha: Math.random() * 0.6 + 0.2,
    twinkle: Math.random() * 0.02 + 0.005,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawStars(ctx, time) {
  for (const s of _stars) {
    s.phase += s.twinkle;
    const a = s.alpha * (0.6 + 0.4 * Math.sin(s.phase));
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── 피어 ──────────────────────────────────────────────────────────────────────

function drawPeer(ctx, x, y, active, label) {
  const color = active ? COLORS.peer : COLORS.peerInactive;

  // 피어 원
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = active ? '#93c5fd' : '#1e3a5f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 레이블
  if (label) {
    ctx.fillStyle = active ? '#93c5fd' : '#1e3a5f';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 20);
  }
}

function drawPeerLine(ctx, cx, cy, px, py, active) {
  ctx.strokeStyle = active
    ? 'rgba(59,130,246,0.2)'
    : 'rgba(30,58,95,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(px, py);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── 중심 노드 ────────────────────────────────────────────────────────────────

function drawNode(ctx, x, y, time, pulsing) {
  // pulse 링
  if (pulsing) {
    const pulseR = 28 + 12 * Math.sin(time * 0.003);
    ctx.beginPath();
    ctx.arc(x, y, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.nodePulse;
    ctx.fill();
  }

  // 외부 링
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.node;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 내부 채움
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#1a0a00';
  ctx.fill();

  // ₿ 심볼
  ctx.fillStyle = COLORS.node;
  ctx.font = 'bold 18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₿', x, y + 1);
  ctx.textBaseline = 'alphabetic';
}

// ── 파티클 ───────────────────────────────────────────────────────────────────

function drawParticles(ctx, particles) {
  for (const p of particles) {
    if (p.done) continue;
    ctx.globalAlpha = Math.max(0, p.alpha);

    if (p.kind === 'tx') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.txFill;
      ctx.fill();
      ctx.strokeStyle = COLORS.txStroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (p.kind === 'block') {
      const color = p.validated ? COLORS.blockStroke : '#ef4444';
      ctx.strokeStyle = color;
      ctx.fillStyle = p.validated ? COLORS.blockFill : 'rgba(239,68,68,0.3)';
      ctx.lineWidth = 2;
      const s = p.radius;
      ctx.beginPath();
      ctx.roundRect(p.x - s, p.y - s, s * 2, s * 2, 3);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// ── HUD 패널 ──────────────────────────────────────────────────────────────────

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.strokeStyle = COLORS.hudBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();
}

function drawText(ctx, text, x, y, { color = COLORS.hudText, size = 11, bold = false } = {}) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${size}px Courier New`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function drawStatusDot(ctx, x, y, mode) {
  const color =
    mode === 'zmq' ? COLORS.dotGreen :
    mode === 'rpc' ? COLORS.dotOrange :
    COLORS.dotRed;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ── 메인 draw 함수 ────────────────────────────────────────────────────────────

/**
 * 전체 씬 렌더링
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state  App 상태
 * @param {number} time   requestAnimationFrame timestamp
 */
export function draw(ctx, state, time) {
  const { w, h } = state.canvas;

  // 별 초기화
  if (!_stars || _stars.length === 0) initStars(w, h);

  // 배경
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, w, h);

  // 별
  drawStars(ctx, time);

  const cx = w / 2;
  const cy = h / 2;

  // 피어 라인 + 피어
  for (let i = 0; i < state.peers.length; i++) {
    const peer = state.peers[i];
    drawPeerLine(ctx, cx, cy, peer.x, peer.y, peer.active);
  }
  for (let i = 0; i < state.peers.length; i++) {
    const peer = state.peers[i];
    drawPeer(ctx, peer.x, peer.y, peer.active, peer.label);
  }

  // 파티클
  drawParticles(ctx, state.particles);

  // 중심 노드
  drawNode(ctx, cx, cy, time, state.nodePulsing);

  // HUD
  drawHud(ctx, state, w, h);
}

function drawHud(ctx, state, w, h) {
  const layout = getHudLayout(w, h);

  // ── 노드 정보 패널 ──
  const np = layout.nodePanel;
  drawPanel(ctx, np.x, np.y, np.w, np.h);
  const nl = np.x + 12;
  let ny = np.y + 20;
  drawText(ctx, 'NODE INFO', nl, ny, { bold: true, size: 12 });
  ny += 18;
  drawText(ctx, `Chain:  ${state.chain || '—'}`, nl, ny, { size: 10 });
  ny += 16;
  drawText(ctx, `Height: ${state.blockHeight != null ? state.blockHeight.toLocaleString() : '—'}`, nl, ny, { size: 10 });
  ny += 16;
  drawText(ctx, `Peers:  ${state.peerCount != null ? state.peerCount : '—'}`, nl, ny, { size: 10 });
  ny += 16;
  drawText(ctx, `Mempool:${state.mempoolCount != null ? ' ' + state.mempoolCount.toLocaleString() + ' tx' : ' —'}`, nl, ny, { size: 10 });
  ny += 16;
  drawText(ctx, `Sync:   ${state.syncPct != null ? (state.syncPct * 100).toFixed(1) + '%' : '—'}`, nl, ny, { size: 10 });

  // ── 상태 패널 ──
  const sp = layout.statusPanel;
  drawPanel(ctx, sp.x, sp.y, sp.w, sp.h);
  const sl = sp.x + 12;
  let sy = sp.y + 20;
  drawText(ctx, 'CONNECTION', sl, sy, { bold: true, size: 12 });
  sy += 22;
  drawStatusDot(ctx, sl + 5, sy - 4, state.mode);
  drawText(ctx, `  ${state.mode === 'zmq' ? 'ZMQ + RPC' : state.mode === 'rpc' ? 'RPC only' : 'No connection'}`,
    sl + 2, sy, { size: 10, color: state.mode === 'zmq' ? COLORS.dotGreen : state.mode === 'rpc' ? COLORS.dotOrange : COLORS.dotRed });
  sy += 18;
  drawText(ctx, `WS clients: ${state.wsClients || 0}`, sl, sy, { size: 10, color: COLORS.hudDim });

  // ── 최근 블록 패널 ──
  const bp = layout.blockPanel;
  drawPanel(ctx, bp.x, bp.y, bp.w, bp.h);
  const bl = bp.x + 12;
  let by = bp.y + 20;
  drawText(ctx, 'RECENT BLOCKS', bl, by, { bold: true, size: 12 });
  by += 6;

  const recent = (state.recentBlocks || []).slice(0, 5);
  if (recent.length === 0) {
    by += 16;
    drawText(ctx, 'Waiting for blocks...', bl, by, { size: 10, color: COLORS.hudDim });
  } else {
    for (const b of recent) {
      by += 18;
      const hash = b.hash ? b.hash.slice(0, 12) + '…' : '—';
      drawText(ctx, `#${b.height ?? '?'} ${hash}`, bl, by, { size: 10 });
      by += 13;
      drawText(ctx, `  ${b.txCount ?? '?'} txs  ${b.merkleOk ? '✓' : '✗'}`, bl, by,
        { size: 9, color: b.merkleOk ? COLORS.dotGreen : COLORS.dotRed });
    }
  }
}

export { initStars };
