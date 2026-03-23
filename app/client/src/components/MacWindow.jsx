import React, { useMemo, useState } from 'react';
import useDrag from '../hooks/useDrag.js';

/**
 * MacWindow — macOS 스타일 플로팅 패널 래퍼
 *
 * Props:
 *   title           — 타이틀바 텍스트
 *   titleColor      — 타이틀 텍스트 색상 클래스
 *   initialPosition — { x, y }
 *   onClose         — 닫기 콜백
 *   onMinimize      — 최소화 콜백
 *   minimized       — 최소화 여부
 *   zIndex          — z-index 값
 *   onFocus         — 포커스(클릭) 콜백
 *   width           — CSS width (기본 320px)
 *   height          — CSS height (기본 auto)
 *   children        — 내부 콘텐츠
 *   className       — 추가 CSS 클래스
 *   headerRight     — 타이틀 우측 추가 요소
 */
export default function MacWindow({
  title,
  titleColor = 'text-text-primary',
  initialPosition = { x: 100, y: 100 },
  onClose,
  onMinimize,
  minimized = false,
  zIndex = 10,
  onFocus,
  width = 320,
  height,
  children,
  className = '',
  headerRight,
}) {
  const initPos = useMemo(() => initialPosition, [initialPosition.x, initialPosition.y]);
  const { position, dragHandleProps, elRef } = useDrag(initPos);
  const [isMaximized, setIsMaximized] = useState(false);

  // 모바일에서는 고정 위치
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const style = isMaximized
    ? { position: 'fixed', top: 8, left: 8, width: 'calc(100vw - 16px)', height: 'calc(100vh - 16px)', zIndex: 50 }
    : isMobile
      ? { zIndex, width: 'calc(100vw - 16px)', left: 8, bottom: 8, position: 'fixed' }
      : {
          zIndex,
          left: position.x,
          top: position.y,
          width: typeof width === 'number' ? `${width}px` : width,
          ...(height && !minimized ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
        };

  return (
    <div
      ref={elRef}
      className={`absolute panel-base flex flex-col overflow-hidden panel-spring ${className}`}
      style={style}
      onMouseDown={onFocus}
    >
      {/* 타이틀바 */}
      <div
        className="flex items-center px-3 py-2 shrink-0 border-b border-dark-border bg-panel-bg-solid/60 mac-window-drag select-none"
        {...dragHandleProps}
      >
        <div className="flex items-center gap-1.5 mr-3">
          {onClose && (
            <span
              className="traffic-light traffic-light--close focus-ring rounded-full"
              title="닫기"
              tabIndex={0}
              role="button"
              aria-label="닫기"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClose(); } }}
            />
          )}
          {onMinimize && (
            <span
              className="traffic-light traffic-light--minimize focus-ring rounded-full"
              title={minimized ? '확장' : '최소화'}
              tabIndex={0}
              role="button"
              aria-label={minimized ? '확장' : '최소화'}
              onClick={(e) => { e.stopPropagation(); onMinimize(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onMinimize(); } }}
            />
          )}
          <span
            className="traffic-light traffic-light--expand focus-ring rounded-full"
            title={isMaximized ? '복원' : '최대화'}
            tabIndex={0}
            role="button"
            aria-label={isMaximized ? '복원' : '최대화'}
            onClick={(e) => { e.stopPropagation(); setIsMaximized(m => !m); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setIsMaximized(m => !m); } }}
          />
        </div>
        <span className={`${titleColor} font-bold text-xs tracking-wide flex-1`}>
          {title}
        </span>
        {headerRight}
      </div>

      {/* 콘텐츠 (최소화 시 숨김) */}
      {!minimized && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}
