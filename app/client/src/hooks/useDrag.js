import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 드래그 훅 — 마우스/터치로 요소 이동
 * viewport 경계 클램핑 포함
 */
export default function useDrag(initialPosition = { x: 0, y: 0 }) {
  const [position, setPosition] = useState(initialPosition);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const elRef = useRef(null);

  // 초기 위치가 바뀌면 리셋
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition.x, initialPosition.y]);

  const clamp = useCallback((x, y) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = elRef.current;
    const w = el?.offsetWidth || 300;
    const h = el?.offsetHeight || 200;
    return {
      x: Math.max(0, Math.min(x, vw - Math.min(w, vw))),
      y: Math.max(0, Math.min(y, vh - Math.min(44, vh))),
    };
  }, []);

  const onMove = useCallback((clientX, clientY) => {
    if (!dragging.current) return;
    const next = clamp(clientX - offset.current.x, clientY - offset.current.y);
    setPosition(next);
  }, [clamp]);

  const onEnd = useCallback(() => {
    dragging.current = false;
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => onMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleUp = () => onEnd();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [onMove, onEnd]);

  const dragHandleProps = {
    onMouseDown: (e) => {
      // 모바일에서는 드래그 비활성화
      if (window.innerWidth < 640) return;
      dragging.current = true;
      offset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      document.body.style.userSelect = 'none';
    },
    onTouchStart: (e) => {
      if (window.innerWidth < 640) return;
      if (e.touches.length === 1) {
        dragging.current = true;
        offset.current = {
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        };
      }
    },
  };

  return { position, setPosition, dragHandleProps, elRef };
}
