import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';

// 수수료율 기반 색상
function feeColor(feeRate) {
  if (feeRate >= 50) return '#ef4444';
  if (feeRate >= 20) return '#f59e0b';
  if (feeRate >= 10) return '#34d399';
  return '#60a5fa';
}

// 수수료율 기반 글로우 색상 (투명도 포함)
function feeGlow(feeRate) {
  if (feeRate >= 50) return 'rgba(239,68,68,0.4)';
  if (feeRate >= 20) return 'rgba(245,158,11,0.4)';
  if (feeRate >= 10) return 'rgba(52,211,153,0.3)';
  return 'rgba(96,165,250,0.3)';
}

const MAX_BLOCKS = 200;
const GRAVITY = 2;
const TERMINAL_VEL = 8;
const COLUMN_COUNT = 40;

/**
 * BitfeedFloor — Canvas2D 멤풀 바닥 애니메이션
 *
 * ref를 통해 외부에서 호출:
 *   addBlock(txData)      — 검증 통과 TX를 떨어뜨림
 *   addRejected(txData)   — 반려 TX를 빨간색으로 떨어뜨림 (바닥 전 파편화)
 *   sweepBlocks(txids)    — 블록 채굴 시 TX들을 위로 날림
 */
const BitfeedFloor = forwardRef(function BitfeedFloor({ className }, ref) {
  const canvasRef = useRef(null);
  const blocksRef = useRef([]);      // { x, y, w, h, vy, color, glow, txid, settled, rejected, shards, opacity, enterTime }
  const dimsRef = useRef({ w: 600, h: 200 });
  const columnsRef = useRef(new Float32Array(COLUMN_COUNT)); // 각 컬럼의 바닥 높이 (쌓인 양)
  const animRef = useRef(null);

  // 블록 크기 계산 (weight 기반)
  const calcSize = useCallback((weight) => {
    const side = Math.sqrt(weight || 560) * 0.45 + 4;
    return Math.max(8, Math.min(45, Math.round(side)));
  }, []);

  // 가장 빈 컬럼 찾기
  const findBestColumn = useCallback((blockW) => {
    const cols = columnsRef.current;
    const colWidth = dimsRef.current.w / COLUMN_COUNT;
    const spanCols = Math.max(1, Math.ceil(blockW / colWidth));
    let bestStart = 0;
    let bestHeight = Infinity;

    for (let i = 0; i <= COLUMN_COUNT - spanCols; i++) {
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
      x: bestStart * colWidth + (colWidth * spanCols - blockW) / 2,
      floorY: dimsRef.current.h - bestHeight - blockW - 2,
      startCol: bestStart,
      spanCols,
    };
  }, []);

  // 컬럼 높이 업데이트
  const updateColumnHeight = useCallback((startCol, spanCols, blockH) => {
    const cols = columnsRef.current;
    for (let j = startCol; j < startCol + spanCols; j++) {
      if (j < COLUMN_COUNT) cols[j] += blockH + 1;
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
    };

    const blocks = blocksRef.current;
    blocks.push(block);

    // 최대 제한 (컬럼 높이는 tick()에서 자동 재계산)
    if (blocks.length > MAX_BLOCKS) {
      blocks.shift();
    }
  }, [calcSize, findBestColumn]);

  // 반려 TX 추가
  const addRejected = useCallback((txData) => {
    const weight = txData.weight || 560;
    const size = calcSize(weight);
    const colWidth = dimsRef.current.w / COLUMN_COUNT;
    const col = Math.floor(Math.random() * (COLUMN_COUNT - 2));

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
        // 컬럼 높이는 tick()에서 자동 재계산
      }
    }

    // sweep 된 블록 500ms 후 제거
    setTimeout(() => {
      blocksRef.current = blocksRef.current.filter((b) => !b.sweeping || b.opacity > 0.05);
    }, 600);
  }, []);

  // ref 노출
  useImperativeHandle(ref, () => ({
    addBlock,
    addRejected,
    sweepBlocks,
  }), [addBlock, addRejected, sweepBlocks]);

  // 파편 생성 (반려 TX 바닥 도달 시)
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

  // 메인 애니메이션 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let running = true;

    // ResizeObserver로 크기 추적
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
      }
    });
    resizeObs.observe(canvas.parentElement);

    function tick() {
      if (!running) return;

      const { w, h } = dimsRef.current;
      const blocks = blocksRef.current;
      const cols = columnsRef.current;

      // 매 프레임 컬럼 높이 재계산 (settled + 비sweep 블록만)
      cols.fill(0);
      for (const b of blocks) {
        if (b.settled && !b.sweeping) {
          for (let j = b.startCol; j < b.startCol + b.spanCols; j++) {
            if (j < COLUMN_COUNT) cols[j] += b.h + 1;
          }
        }
      }

      // 물리 업데이트
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];

        // sweep 후 떠있는 settled 블록 → 재낙하
        if (b.settled && !b.sweeping) {
          let maxH = 0;
          for (let j = b.startCol; j < b.startCol + b.spanCols; j++) {
            if (j < COLUMN_COUNT) {
              // 자신의 높이를 제외한 컬럼 높이
              const selfContrib = b.h + 1;
              const othersH = cols[j] - selfContrib;
              if (othersH > maxH) maxH = othersH;
            }
          }
          const expectedFloorY = h - maxH - b.h - 2;
          if (b.y < expectedFloorY - 2) {
            // 블록이 떠있음 → 재낙하
            b.settled = false;
            b.floorY = expectedFloorY;
          }
          continue;
        }

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

        // 낙하 중인 블록: floorY 동적 재계산
        if (!b.rejected) {
          let maxH = 0;
          for (let j = b.startCol; j < b.startCol + b.spanCols; j++) {
            if (j < COLUMN_COUNT && cols[j] > maxH) maxH = cols[j];
          }
          b.floorY = h - maxH - b.h - 2;
        }

        // 중력
        b.vy = Math.min(b.vy + GRAVITY, TERMINAL_VEL);
        b.y += b.vy;

        // 바닥 착지
        if (b.y >= b.floorY) {
          b.y = b.floorY;
          b.vy = 0;

          if (b.rejected) {
            // 반려: 파편화
            b.shards = createShards(b);
          } else {
            // 착지 (settled)
            b.settled = true;
          }
        }
      }

      // 렌더링
      ctx.clearRect(0, 0, w, h);

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

        ctx.globalAlpha = b.opacity;

        // 글로우 (신규 & 비settled)
        if (!b.settled && !b.sweeping) {
          ctx.shadowColor = b.glow;
          ctx.shadowBlur = 8;
        }

        ctx.fillStyle = b.settled
          ? b.color + '88'  // settled은 약간 투명
          : b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // 테두리
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        // settled 블록에 TXID 텍스트 (크기 >= 20px일 때만)
        if (b.settled && b.txid && b.w >= 16) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
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
      />
    </div>
  );
});

export default BitfeedFloor;
