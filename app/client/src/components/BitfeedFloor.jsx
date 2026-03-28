import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { feeColor, feeGlow, FEE_LEGEND } from '../utils/colors.js';
import { squarify } from '../utils/treemap.js';
import TxTooltip from './TxTooltip.jsx';

const MAX_BLOCKS = 400;
const ANIM_DURATION = 350;
const SWEEP_DURATION = 700;

/**
 * BitfeedFloor — Treemap 기반 멤풀 시각화
 * TX 도착 즉시 트리맵에 추가, 블록 채굴 시 하얗게 변하며 사라짐
 */
const BitfeedFloor = forwardRef(function BitfeedFloor({ className, onTxClick }, ref) {
  const canvasRef = useRef(null);
  const blocksRef = useRef([]);
  const layoutRef = useRef([]);
  const prevLayoutRef = useRef(new Map());
  const dimsRef = useRef({ w: 600, h: 200 });
  const dirtyRef = useRef(true);
  const animRef = useRef(null);
  const layoutTimeRef = useRef(0);
  const sweepingRef = useRef(new Map());
  const shardsRef = useRef([]);

  const [hoveredTx, setHoveredTx] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoveredTxRef = useRef(null);
  const [hasBlocks, setHasBlocks] = useState(false);

  const recalcLayout = useCallback(() => {
    const { w, h } = dimsRef.current;
    const blocks = blocksRef.current;
    if (!blocks.length || w <= 0 || h <= 0) { layoutRef.current = []; return; }
    const prevMap = new Map();
    for (const rect of layoutRef.current) prevMap.set(rect.txid, { x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    prevLayoutRef.current = prevMap;
    layoutRef.current = squarify(blocks.map(b => ({ ...b })), w, h);
    layoutTimeRef.current = Date.now();
    dirtyRef.current = false;
  }, []);

  const addBlock = useCallback((txData) => {
    const weight = txData.weight || 560;
    const feeRate = txData.feeRate || (txData.fee && txData.weight ? Math.round(txData.fee / (txData.weight / 4)) : 5);
    const blocks = blocksRef.current;
    if (blocks.some(b => b.txid === txData.txid)) return;
    blocks.push({
      txid: txData.txid, weight, feeRate, color: feeColor(feeRate), glow: feeGlow(feeRate),
      fee: txData.fee, txSize: txData.size, inputCount: txData.vin, outputCount: txData.vout,
      totalValue: txData.totalOut || txData.totalValue, enterTime: Date.now(),
    });
    if (!hasBlocks) setHasBlocks(true);
    if (blocks.length > MAX_BLOCKS) blocks.shift();
    dirtyRef.current = true;
  }, [hasBlocks]);

  const addRejected = useCallback((txData) => {
    const { w, h } = dimsRef.current;
    for (let i = 0; i < 6; i++) {
      shardsRef.current.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 8, vy: -(2 + Math.random() * 5), size: 2 + Math.random() * 4, opacity: 1, color: '#ef4444' });
    }
  }, []);

  const sweepBlocks = useCallback((txids) => {
    if (!txids?.length) return;
    const idSet = new Set(txids);
    const now = Date.now();
    for (const rect of layoutRef.current) {
      if (idSet.has(rect.txid)) sweepingRef.current.set(rect.txid, { startTime: now, x: rect.x, y: rect.y, w: rect.w, h: rect.h, color: rect.color });
    }
    blocksRef.current = blocksRef.current.filter(b => !idSet.has(b.txid));
    dirtyRef.current = true;
  }, []);

  useImperativeHandle(ref, () => ({ addBlock, addRejected, sweepBlocks }), [addBlock, addRejected, sweepBlocks]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });
    for (let i = layoutRef.current.length - 1; i >= 0; i--) {
      const r = layoutRef.current[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        hoveredTxRef.current = r.txid;
        setHoveredTx({ txid: r.txid, feeRate: r.feeRate, fee: r.fee, size: r.txSize, weight: r.weight, inputCount: r.inputCount, outputCount: r.outputCount, totalValue: r.totalValue });
        return;
      }
    }
    hoveredTxRef.current = null; setHoveredTx(null);
  }, []);

  const handleMouseLeave = useCallback(() => { hoveredTxRef.current = null; setHoveredTx(null); }, []);

  const handleCanvasClick = useCallback((e) => {
    if (!onTxClick) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    for (let i = layoutRef.current.length - 1; i >= 0; i--) {
      const r = layoutRef.current[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { onTxClick({ txid: r.txid, data: { feeRate: r.feeRate } }); return; }
    }
  }, [onTxClick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let running = true;

    const resizeObs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr; canvas.height = height * dpr;
        canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dimsRef.current = { w: width, h: height };
        dirtyRef.current = true;
      }
    });
    resizeObs.observe(canvas.parentElement);

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function tick() {
      if (!running) return;
      const { w, h } = dimsRef.current;
      const now = Date.now();
      const hovTxid = hoveredTxRef.current;

      if (dirtyRef.current) recalcLayout();
      ctx.clearRect(0, 0, w, h);

      const layout = layoutRef.current;
      const prevMap = prevLayoutRef.current;
      const elapsed = now - layoutTimeRef.current;
      const g = 0.5;

      for (const r of layout) {
        const isHovered = r.txid === hovTxid;
        const isNew = (now - (r.enterTime || 0)) < ANIM_DURATION;
        let dx = r.x, dy = r.y, dw = r.w, dh = r.h;
        const prev = prevMap.get(r.txid);

        if (prev && elapsed < ANIM_DURATION) {
          const t = easeOut(Math.min(1, elapsed / ANIM_DURATION));
          dx = prev.x + (r.x - prev.x) * t; dy = prev.y + (r.y - prev.y) * t;
          dw = prev.w + (r.w - prev.w) * t; dh = prev.h + (r.h - prev.h) * t;
        }
        // 신규 TX: 크기 유지, opacity 페이드인 (빈 공간 방지)
        let cellAlpha = 1;
        if (isNew && !prev) {
          cellAlpha = easeOut(Math.min(1, (now - r.enterTime) / ANIM_DURATION));
        }
        if (dw < 1 || dh < 1) continue;
        if (cellAlpha < 1) ctx.globalAlpha = cellAlpha;

        if (isHovered) { ctx.shadowColor = r.glow || 'rgba(255,255,255,0.3)'; ctx.shadowBlur = 10; }
        ctx.fillStyle = isHovered ? r.color : r.color + 'DD';
        ctx.fillRect(dx + g, dy + g, dw - g * 2, dh - g * 2);

        if (dw > 6 && dh > 6) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(dx + g, dy + g, dw - g * 2, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(dx + g, dy + dh - g - 1, dw - g * 2, 1);
        }
        if (isHovered) {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
          ctx.strokeRect(dx + g, dy + g, dw - g * 2, dh - g * 2); ctx.shadowBlur = 0;
        }
        if (r.txid && dw >= 28 && dh >= 12) {
          ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)';
          ctx.font = dw >= 55 ? '8px monospace' : '6px monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(r.txid.slice(0, Math.max(4, Math.floor(dw / 7))), dx + dw / 2, dy + dh / 2);
        }
        ctx.shadowBlur = 0;
        if (cellAlpha < 1) ctx.globalAlpha = 1;
      }

      // sweep (하얗게 → 위로)
      for (const [txid, s] of sweepingRef.current) {
        const t = (now - s.startTime) / SWEEP_DURATION;
        if (t >= 1) { sweepingRef.current.delete(txid); continue; }
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = s.color || '#60a5fa';
        ctx.fillRect(s.x, s.y - t * 60, s.w, s.h);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, t * 2.5) * 0.85})`;
        ctx.fillRect(s.x, s.y - t * 60, s.w, s.h);
        ctx.globalAlpha = 1;
      }

      // 파편
      for (let i = shardsRef.current.length - 1; i >= 0; i--) {
        const s = shardsRef.current[i];
        s.x += s.vx; s.y += s.vy; s.vy += 0.3; s.opacity -= 0.02;
        if (s.opacity <= 0) { shardsRef.current.splice(i, 1); continue; }
        ctx.globalAlpha = s.opacity; ctx.fillStyle = s.color;
        ctx.shadowColor = 'rgba(239,68,68,0.6)'; ctx.shadowBlur = 4;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; if (animRef.current) cancelAnimationFrame(animRef.current); resizeObs.disconnect(); };
  }, [recalcLayout]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
        onClick={handleCanvasClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }} role="img"
        aria-label="멤풀 트랜잭션 시각화. 셀 크기는 TX weight에 비례, 색상은 수수료율 표시." />
      {!hasBlocks && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-text-dim text-label tracking-wide">TX를 기다리는 중...</span>
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex gap-2 text-label bg-[rgba(6,10,20,0.8)] rounded px-2 py-1">
        {FEE_LEGEND.map((item) => (<span key={item.label} style={{ color: item.color }}>● {item.label}</span>))}
      </div>
      <TxTooltip tx={hoveredTx} x={mousePos.x} y={mousePos.y} />
    </div>
  );
});

export default BitfeedFloor;
