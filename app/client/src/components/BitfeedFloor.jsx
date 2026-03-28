import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { feeColor, feeGlow, FEE_LEGEND } from '../utils/colors.js';
import TxTooltip from './TxTooltip.jsx';

const MAX_BLOCKS = 500;
const GRAVITY = 1.8;
const TERMINAL_VEL = 10;
const COL_PX = 8; // 밀집 패킹용 좁은 컬럼
const GAP = 0.5;  // 블록 간 미세 간격

/**
 * BitfeedFloor — Bitfeed 스타일 중력 기반 멤풀 시각화
 *
 * TX가 위에서 떨어져 바닥에 차곡차곡 쌓이고,
 * 블록 채굴 시 포함된 TX가 하얗게 변하며 사라진다.
 */
const BitfeedFloor = forwardRef(function BitfeedFloor({ className, onTxClick }, ref) {
  const canvasRef = useRef(null);
  const blocksRef = useRef([]);
  const dimsRef = useRef({ w: 600, h: 200 });
  const colCountRef = useRef(Math.floor(600 / COL_PX));
  const colHeightsRef = useRef(new Float32Array(colCountRef.current));
  const dirtyRef = useRef(false);
  const animRef = useRef(null);

  // 호버 상태
  const [hoveredTx, setHoveredTx] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoveredTxRef = useRef(null);
  const [hasBlocks, setHasBlocks] = useState(false);

  // 블록 크기 계산 (weight 기반, bitfeed 스타일)
  const calcSize = useCallback((weight) => {
    const side = Math.sqrt(weight || 560) * 0.35 + 3;
    return Math.max(6, Math.min(40, Math.round(side)));
  }, []);

  // 가장 낮은 컬럼 범위 찾기
  const findBestCol = useCallback((blockW) => {
    const cols = colHeightsRef.current;
    const count = colCountRef.current;
    const { w, h } = dimsRef.current;
    const colW = w / count;
    const span = Math.max(1, Math.ceil(blockW / colW));

    let bestStart = 0;
    let bestH = Infinity;
    for (let i = 0; i <= count - span; i++) {
      let maxH = 0;
      for (let j = i; j < i + span; j++) {
        if (cols[j] > maxH) maxH = cols[j];
      }
      if (maxH < bestH) {
        bestH = maxH;
        bestStart = i;
      }
    }

    return {
      x: bestStart * colW,
      floorY: h - bestH - blockW - GAP,
      startCol: bestStart,
      span,
    };
  }, []);

  // 컬럼 높이 전체 재계산 (settled 블록 기반)
  const rebuildColumns = useCallback(() => {
    const cols = colHeightsRef.current;
    const count = colCountRef.current;
    const { w, h } = dimsRef.current;
    const colW = w / count;
    cols.fill(0);

    const settled = blocksRef.current.filter(b => b.settled && !b.sweeping && !b.shards);
    // y 큰 순 (바닥부터)
    settled.sort((a, b) => b.y - a.y);

    for (const b of settled) {
      const span = Math.max(1, Math.ceil(b.w / colW));
      const startCol = Math.max(0, Math.min(count - span, Math.round(b.x / colW)));

      let maxH = 0;
      for (let j = startCol; j < startCol + span && j < count; j++) {
        if (cols[j] > maxH) maxH = cols[j];
      }
      b.y = h - maxH - b.h - GAP;
      b.floorY = b.y;
      b.startCol = startCol;
      b.span = span;

      for (let j = startCol; j < startCol + span && j < count; j++) {
        cols[j] = maxH + b.h + GAP;
      }
    }
  }, []);

  // TX 추가
  const addBlock = useCallback((txData) => {
    const weight = txData.weight || 560;
    const feeRate = txData.feeRate || (txData.fee && txData.weight ? Math.round(txData.fee / (txData.weight / 4)) : 5);
    const size = calcSize(weight);
    const col = findBestCol(size);

    const block = {
      x: col.x,
      y: -size - Math.random() * 40, // 화면 위에서 시작
      w: size,
      h: size,
      vy: 0,
      color: feeColor(feeRate),
      glow: feeGlow(feeRate),
      txid: txData.txid,
      settled: false,
      sweeping: false,
      sweepTime: 0,
      shards: null,
      opacity: 1,
      floorY: col.floorY,
      startCol: col.startCol,
      span: col.span,
      feeRate,
      fee: txData.fee,
      txSize: txData.size,
      weight,
      inputCount: txData.vin,
      outputCount: txData.vout,
      totalValue: txData.totalOut || txData.totalValue,
    };

    const blocks = blocksRef.current;
    if (blocks.some(b => b.txid === block.txid)) return;
    blocks.push(block);
    if (!hasBlocks) setHasBlocks(true);

    // 착지 시 컬럼 높이 업데이트는 tick()에서 처리

    if (blocks.length > MAX_BLOCKS) {
      const removed = blocks.shift();
      dirtyRef.current = true; // 컬럼 재계산 필요
    }
  }, [calcSize, findBestCol, hasBlocks]);

  // 반려 TX
  const addRejected = useCallback((txData) => {
    const weight = txData.weight || 560;
    const size = calcSize(weight);
    const { w } = dimsRef.current;
    const x = Math.random() * (w - size);

    const block = {
      x,
      y: -size - Math.random() * 20,
      w: size, h: size,
      vy: 0,
      color: '#ef4444',
      glow: 'rgba(239,68,68,0.6)',
      txid: txData.txid,
      settled: false,
      sweeping: false,
      rejected: true,
      shards: null,
      opacity: 1,
      floorY: dimsRef.current.h * 0.65 + Math.random() * (dimsRef.current.h * 0.15),
      startCol: 0, span: 1,
      feeRate: 0,
    };
    blocksRef.current.push(block);
  }, [calcSize]);

  // 블록 채굴 sweep
  const sweepBlocks = useCallback((txids) => {
    if (!txids?.length) return;
    const idSet = new Set(txids);
    const now = Date.now();

    for (const b of blocksRef.current) {
      if (idSet.has(b.txid) && b.settled && !b.sweeping) {
        b.sweeping = true;
        b.sweepTime = now;
      }
    }
  }, []);

  useImperativeHandle(ref, () => ({
    addBlock, addRejected, sweepBlocks,
  }), [addBlock, addRejected, sweepBlocks]);

  // 파편 생성
  const createShards = useCallback((block) => {
    const shards = [];
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      shards.push({
        x: block.x + block.w * Math.random(),
        y: block.floorY,
        vx: (Math.random() - 0.5) * 6,
        vy: -(2 + Math.random() * 4),
        size: 2 + Math.random() * 3,
        opacity: 1,
      });
    }
    return shards;
  }, []);

  // 호버
  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    for (let i = blocksRef.current.length - 1; i >= 0; i--) {
      const b = blocksRef.current[i];
      if (b.shards || b.sweeping) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        hoveredTxRef.current = b.txid;
        setHoveredTx({
          txid: b.txid, feeRate: b.feeRate, fee: b.fee,
          size: b.txSize, weight: b.weight,
          inputCount: b.inputCount, outputCount: b.outputCount,
          totalValue: b.totalValue,
        });
        return;
      }
    }
    hoveredTxRef.current = null;
    setHoveredTx(null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredTxRef.current = null;
    setHoveredTx(null);
  }, []);

  const handleCanvasClick = useCallback((e) => {
    if (!onTxClick) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (let i = blocksRef.current.length - 1; i >= 0; i--) {
      const b = blocksRef.current[i];
      if (b.shards || b.sweeping) continue;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        onTxClick({ txid: b.txid, data: { feeRate: b.feeRate } });
        return;
      }
    }
  }, [onTxClick]);

  // 메인 애니메이션 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let running = true;

    const resizeObs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dimsRef.current = { w: width, h: height };
        const newCount = Math.max(20, Math.floor(width / COL_PX));
        colCountRef.current = newCount;
        colHeightsRef.current = new Float32Array(newCount);
        dirtyRef.current = true;
      }
    });
    resizeObs.observe(canvas.parentElement);

    function tick() {
      if (!running) return;
      const { w, h } = dimsRef.current;
      const blocks = blocksRef.current;
      const cols = colHeightsRef.current;
      const colCount = colCountRef.current;
      const colW = w / colCount;
      const now = Date.now();
      const hovTxid = hoveredTxRef.current;
      let needRebuild = dirtyRef.current;

      // sweep 처리 (하얗게 변하며 위로 사라짐)
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        if (b.sweeping) {
          const elapsed = now - b.sweepTime;
          if (elapsed > 800) {
            blocks.splice(i, 1);
            needRebuild = true;
          }
          continue;
        }
        // 파편 처리
        if (b.shards) {
          let allDone = true;
          for (const s of b.shards) {
            s.x += s.vx; s.y += s.vy; s.vy += 0.3; s.opacity -= 0.025;
            if (s.opacity > 0) allDone = false;
          }
          if (allDone) { blocks.splice(i, 1); needRebuild = true; }
        }
      }

      // 컬럼 재계산 (dirty 시)
      if (needRebuild) {
        rebuildColumns();
        dirtyRef.current = false;
      }

      // 낙하 블록 처리
      for (const b of blocks) {
        if (b.sweeping || b.shards || b.settled) continue;

        if (b.rejected) {
          b.vy = Math.min(b.vy + GRAVITY, TERMINAL_VEL);
          b.y += b.vy;
          if (b.y >= b.floorY) {
            b.y = b.floorY;
            b.shards = createShards(b);
          }
          continue;
        }

        // floorY 실시간 계산
        const span = Math.max(1, Math.ceil(b.w / colW));
        const startCol = Math.max(0, Math.min(colCount - span, Math.round(b.x / colW)));
        let maxH = 0;
        for (let j = startCol; j < startCol + span && j < colCount; j++) {
          if (cols[j] > maxH) maxH = cols[j];
        }
        b.floorY = h - maxH - b.h - GAP;

        b.vy = Math.min(b.vy + GRAVITY, TERMINAL_VEL);
        b.y += b.vy;

        if (b.y >= b.floorY) {
          b.y = b.floorY;
          b.vy = 0;
          b.settled = true;
          b.startCol = startCol;
          b.span = span;
          // 컬럼 높이 업데이트
          for (let j = startCol; j < startCol + span && j < colCount; j++) {
            cols[j] += b.h + GAP;
          }
        }
      }

      // ── 렌더링 ──
      ctx.clearRect(0, 0, w, h);

      // 점선 구분선
      const maxColH = Math.max(...cols);
      if (maxColH > 2) {
        const lineY = h - maxColH - 4;
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(w, lineY);
        ctx.stroke();
        ctx.restore();
      }

      for (const b of blocks) {
        // 파편
        if (b.shards) {
          for (const s of b.shards) {
            if (s.opacity <= 0) continue;
            ctx.globalAlpha = s.opacity;
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = 'rgba(239,68,68,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillRect(s.x, s.y, s.size, s.size);
          }
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          continue;
        }

        // sweep 애니메이션: 하얗게 변하며 위로 페이드
        if (b.sweeping) {
          const elapsed = now - b.sweepTime;
          const t = Math.min(1, elapsed / 800);
          ctx.globalAlpha = 1 - t;
          // 색상이 점점 하얗게
          const whiteMix = Math.min(1, t * 2); // 0~0.5초에 완전 하얗게
          if (whiteMix < 1) {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x + GAP, b.y - t * 30 + GAP, b.w - GAP * 2, b.h - GAP * 2);
          }
          ctx.fillStyle = `rgba(255,255,255,${whiteMix * 0.8})`;
          ctx.fillRect(b.x + GAP, b.y - t * 30 + GAP, b.w - GAP * 2, b.h - GAP * 2);
          ctx.globalAlpha = 1;
          continue;
        }

        const isHovered = b.txid === hovTxid;

        // 낙하 중 글로우
        if (!b.settled) {
          ctx.shadowColor = b.glow;
          ctx.shadowBlur = 6;
        } else if (isHovered) {
          ctx.shadowColor = b.glow;
          ctx.shadowBlur = 10;
        }

        // 블록 색상
        ctx.fillStyle = isHovered ? b.color : (b.settled ? b.color + 'DD' : b.color);
        ctx.fillRect(b.x + GAP, b.y + GAP, b.w - GAP * 2, b.h - GAP * 2);

        // 입체 효과
        if (b.settled && b.w >= 8) {
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(b.x + GAP, b.y + GAP, b.w - GAP * 2, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(b.x + GAP, b.y + b.h - GAP - 1, b.w - GAP * 2, 1);
        }

        // 호버 테두리
        if (isHovered) {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(b.x + GAP, b.y + GAP, b.w - GAP * 2, b.h - GAP * 2);
        }

        // TXID 텍스트 (큰 블록만)
        if (b.settled && b.txid && b.w >= 22 && b.h >= 10) {
          ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)';
          ctx.font = b.w >= 35 ? '7px monospace' : '5px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const maxChars = Math.max(3, Math.floor(b.w / 6));
          ctx.fillText(b.txid.slice(0, maxChars), b.x + b.w / 2, b.y + b.h / 2);
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      resizeObs.disconnect();
    };
  }, [createShards, rebuildColumns]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
        role="img"
        aria-label="멤풀 트랜잭션 시각화. TX가 위에서 떨어져 쌓이며, 색상은 수수료율을 표시합니다."
      />
      {!hasBlocks && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-text-dim text-label tracking-wide">TX를 기다리는 중...</span>
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex gap-2 text-label bg-[rgba(6,10,20,0.8)] rounded px-2 py-1">
        {FEE_LEGEND.map((item) => (
          <span key={item.label} style={{ color: item.color }}>● {item.label}</span>
        ))}
      </div>
      <TxTooltip tx={hoveredTx} x={mousePos.x} y={mousePos.y} />
    </div>
  );
});

export default BitfeedFloor;
