import React, { useRef, useEffect, useCallback } from 'react';
import { draw, initStars } from './renderer.js';
import { updateParticles } from './particles.js';

/**
 * Universe — Canvas + HUD 패널 컴포넌트
 * Props:
 *   state: App 상태 (블록, TX, 피어, 모드 등)
 *   onParticlesUpdate: (particles) => void  파티클 배열 업데이트 콜백
 */
export default function Universe({ state, onParticlesUpdate }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(state);
  const rafRef = useRef(null);

  // 매 렌더마다 최신 state를 ref에 유지 (클로저 stale 방지)
  stateRef.current = state;

  // 캔버스 크기 조정
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // 별 재초기화
    initStars(canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  // 애니메이션 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let prevTime = 0;

    function loop(time) {
      rafRef.current = requestAnimationFrame(loop);

      const s = stateRef.current;
      // 파티클 물리 업데이트
      const updatedParticles = updateParticles([...(s.particles || [])]);
      if (onParticlesUpdate) onParticlesUpdate(updatedParticles);

      const drawState = {
        ...s,
        particles: updatedParticles,
        canvas: { w: canvas.width, h: canvas.height },
      };

      draw(ctx, drawState, time);
      prevTime = time;
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onParticlesUpdate]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
