import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { feeColor, feeGlow, FEE_LEGEND } from '../utils/colors.js';
import TxTooltip from './TxTooltip.jsx';

const MAX_BLOCKS = 200;
const GRAVITY = 2;
const TERMINAL_VEL = 8;
const COL_PIXEL_WIDTH = 12; // 블록 ~12px 간격으로 밀집

/**
 * BitfeedFloor — Canvas2D 멤풀 바닥 애니메이션
 *
 * ref를 통해 외부에서 호출:
 *   addBlock(txData)      — 검증 통과 TX를 떨어뜨림
 *   addRejected(txData)   — 반려 TX를 빨간색으로 떨어뜨림 (바닥 전 파편화)
 *   sweepBlocks(txids)    — 블록 채굴 시 TX들을 위로 날림
 */
const BitfeedFloor = forwardRef(function BitfeedFloor({ className, onTxClick }, ref) {
  const canvasRef = useRef(null);
  const blocksRef = useRef([]);
  const dimsRef = useRef({ w: 600, h: 200 });
  const columnCountRef = useRef(Math.floor(600 / COL_PIXEL_WIDTH));
  const columnsRef = useRef(new Float32Array(columnCountRef.current));
  const animRef = useRef(null);

  // 호버 상태
  const [hoveredTx, setHoveredTx] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoveredTxRef = useRef(null);

  // 블록 크기 계산 (weight 기반)
  const calcSize = useCallback((weight) => {
    const side = Math.sqrt(weight || 560) * 0.45 + 4;
    return Math.max(14, Math.min(45, Math.round(side)));
  }, []);

  // 가장 빈 컬럼 찾기 (좌측 정렬, 밀집 배치)
  const findBestColumn = useCallback((blockW) => {
    const cols = columnsRef.current;
    const colCount = columnCountRef.current;
    const colWidth = dimsRef.current.w / colCount;
    const spanCols = Math.max(1, Math.ceil(blockW / colWidth));
    let bestStart = 0;
    let bestHeight = Infinity;

    for (let i = 0; i <= colCount - spanCols; i++) {
      let maxH = 0;
      for (let j = i; j < i + spanCols; j++) {
        if (cols[j] > maxH) maxH = cols[j];
      }
      if (maxH < bestHeight) {
        bestHeight = maxH;
        bestStart = i;
      }
    }

    return {
      x: bestStart * colWidth, // 좌측 정렬 (중앙 정렬 제거)
      floorY: dimsRef.current.h - bestHeight - blockW - 1,
      startCol: bestStart,
      spanCols,
    };
  }, []);

  // 컬럼 높이 업데이트
  const updateColumnHeight = useCallback((startCol, spanCols, blockH) => {
    const cols = columnsRef.current;
    const colCount = columnCountRef.current;
    for (let j = startCol; j < startCol + spanCols; j++) {
      if (j < colCount) cols[j] += blockH + 1;
    }
  }, []);

  // TX 추가 (검증 통과)
  const addBlock = useCallback((txData) => {
    const weight = txData.weight || 560;
    const feeRate = txData.feeRate || (txData.fee && txData.weight ? Math.round(txData.fee / (txData.weight / 4)) : 5);
    const size = calcSize(weight);
    const col = findBestColumn(size);

    const block = {
      x: col.x,
      y: -size - Math.random() * 30,
      w: size,
      h: size,
      vy: 0,
      color: feeColor(feeRate),
      glow: feeGlow(feeRate),
      txid: txData.txid,
      settled: false,
      rejected: false,
      shards: null,
      opacity: 1,
      enterTime: Date.now(),
      floorY: col.floorY,
      startCol: col.startCol,
      spanCols: col.spanCols,
      feeRate,
      // 호버용 추가 데이터
      fee: txData.fee,
      txSize: txData.size,
      weight,
      inputCount: txData.vin,
      outputCount: txData.vout,
      totalValue: txData.totalOut || txData.totalValue,
    };

    const blocks = blocksRef.current;
    blocks.push(block);
    updateColumnHeight(col.startCol, col.spanCols, size);

    if (blocks.length > MAX_BLOCKS) {
      blocks.shift();
    }
  }, [calcSize, findBestColumn, updateColumnHeight]);

  // 반려 TX 추가
  const addRejected = useCallback((txData) => {
    const weight = txData.weight || 560;
    const size = calcSize(weight);
    const colCount = columnCountRef.current;
    const colWidth = dimsRef.current.w / colCount;
    const col = Math.floor(Math.random() * (colCount - 2));

    const block = {
      x: col * colWidth,
      y: -size - Math.random() * 20,
      w: size,
      h: size,
      vy: 0,
      color: '#ef4444',
      glow: 'rgba(239,68,68,0.6)',
      txid: txData.txid,
      settled: false,
      rejected: true,
      shards: null,
      opacity: 1,
      enterTime: Date.now(),
      floorY: dimsRef.current.h * 0.7 + Math.random() * (dimsRef.current.h * 0.15),
      startCol: col,
      spanCols: 1,
      feeRate: 0,
    };

    blocksRef.current.push(block);
  }, [calcSize]);

  // 블록 채굴 sweep
  const sweepBlocks = useCallback((txids) => {
    if (!txids?.length) return;
    const idSet = new Set(txids);
    const blocks = blocksRef.current;

    for (const b of blocks) {
      if (idSet.has(b.txid) && b.settled) {
        b.vy = -15;
        b.settled = false;
        b.sweeping = true;
      }
    }

    setTimeout(() => {
      blocksRef.current = blocksRef.current.filter((b) => !b.sweeping || b.opacity > 0.05);
    }, 600);
  }, []);

  useImperativeHandle(ref, () => ({
    addBlock,
    addRejected,
    sweepBlocks,
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

  // 캔버스 호버 — hit-test
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
          txid: b.txid,
          feeRate: b.feeRate,
          fee: b.fee,
          size: b.txSize,
          weight: b.weight,
          inputCount: b.inputCount,
          outputCount: b.outputCount,
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

  // Canvas 클릭 → TX 상세
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
        // 동적 컬럼 수 업데이트
        const newColCount = Math.max(20, Math.floor(width / COL_PIXEL_WIDTH));
        columnCountRef.current = newColCount;
        columnsRef.current = new Float32Array(newColCount);
      }
    });
    resizeObs.observe(canvas.parentElement);

    function tick() {
      if (!running) return;

      const { w, h } = dimsRef.current;
      const blocks = blocksRef.current;
      const cols = columnsRef.current;
      const colCount = columnCountRef.current;
      const hovTxid = hoveredTxRef.current;

      // 매 프레임 컬럼 높이 재계산
      cols.fill(0);
      for (const b of blocks) {
        if (b.settled && !b.sweeping) {
          for (let j = b.startCol; j < b.startCol + b.spanCols; j++) {
            if (j < colCount) cols[j] += b.h + 1;
          }
        }
      }

      // 물리 업데이트
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];

        if (b.settled && !b.sweeping) continue;
        if (b.settled) continue;

        // sweep 중인 블록
        if (b.sweeping) {
          b.y += b.vy;
          b.opacity -= 0.03;
          if (b.opacity <= 0 || b.y < -b.h * 2) {
            blocks.splice(i, 1);
          }
          continue;
        }

        // 반려 TX 파편 처리
        if (b.shards) {
          let allDone = true;
          for (const s of b.shards) {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.3;
            s.opacity -= 0.025;
            if (s.opacity > 0) allDone = false;
          }
          if (allDone) {
            blocks.splice(i, 1);
          }
          continue;
        }

        // 낙하 중: floorY 동적 재계산
        if (!b.rejected) {
          let maxH = 0;
          for (let j = b.startCol; j < b.startCol + b.spanCols; j++) {
            if (j < colCount && cols[j] > maxH) maxH = cols[j];
          }
          b.floorY = h - maxH - b.h - 1;
        }

        b.vy = Math.min(b.vy + GRAVITY, TERMINAL_VEL);
        b.y += b.vy;

        if (b.y >= b.floorY) {
          b.y = b.floorY;
          b.vy = 0;

          if (b.rejected) {
            b.shards = createShards(b);
          } else {
            b.settled = true;
          }
        }
      }

      // 렌더링
      ctx.clearRect(0, 0, w, h);

      // 점선 구분선 (미확인 TX 영역 하단 경계)
      const maxColH = Math.max(...cols);
      if (maxColH > 0) {
        const lineY = h - maxColH - 4;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(w, lineY);
        ctx.stroke();
        ctx.restore();
      }

      for (const b of blocks) {
        // 파편 렌더
        if (b.shards) {
          for (const s of b.shards) {
            if (s.opacity <= 0) continue;
            ctx.globalAlpha = s.opacity;
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = 'rgba(239,68,68,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillRect(s.x, s.y, s.size, s.size);
          }
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          continue;
        }

        const isHovered = b.txid === hovTxid;
        ctx.globalAlpha = b.opacity;

        // 글로우 (낙하 중 + 호버)
        if (!b.settled && !b.sweeping) {
          ctx.shadowColor = b.glow;
          ctx.shadowBlur = 8;
        } else if (isHovered) {
          ctx.shadowColor = b.glow;
          ctx.shadowBlur = 12;
        }

        // 색상: settled는 0xCC 투명도 (더 선명), 호버 시 풀 밝기
        if (isHovered) {
          ctx.fillStyle = b.color;
        } else if (b.settled) {
          ctx.fillStyle = b.color + 'CC';
        } else {
          ctx.fillStyle = b.color;
        }

        // 블록 간 1px 간격으로 구분 (테두리 제거)
        ctx.fillRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);

        // 큰 블록에 미세한 inner gradient
        if (b.settled && b.w >= 20) {
          const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
          grad.addColorStop(0, 'rgba(255,255,255,0.06)');
          grad.addColorStop(1, 'rgba(0,0,0,0.08)');
          ctx.fillStyle = grad;
          ctx.fillRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        }

        // settled 블록에 TXID 텍스트
        if (b.settled && b.txid && b.w >= 25) {
          ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(b.txid.slice(0, 6), b.x + b.w / 2, b.y + b.h / 2);
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
  }, [createShards]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
      />

      {/* 수수료 범례 */}
      <div className="absolute bottom-3 right-3 flex gap-2 text-[11px] bg-[rgba(6,10,20,0.8)] rounded px-2 py-1">
        {FEE_LEGEND.map((item) => (
          <span key={item.label} style={{ color: item.color }}>● {item.label}</span>
        ))}
      </div>

      {/* 호버 툴팁 */}
      <TxTooltip tx={hoveredTx} x={mousePos.x} y={mousePos.y} />
    </div>
  );
});

export default BitfeedFloor;
