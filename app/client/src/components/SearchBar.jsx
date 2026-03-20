import React, { useState, useCallback } from 'react';

/**
 * SearchBar — 통합 검색 (블록, TX, 주소)
 * 파싱 로직:
 *   - 64자 hex → TXID 또는 블록 해시
 *   - 숫자만 → 블록 높이
 *   - bc1/1/3으로 시작 → 주소
 */
export default function SearchBar({ onSearchBlock, onSearchTx, onSearchAddress }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setError('');

    // 블록 높이 (숫자만)
    if (/^\d+$/.test(q)) {
      const height = parseInt(q, 10);
      onSearchBlock?.({ height });
      setQuery('');
      return;
    }

    // 64자 hex → TXID 또는 블록 해시
    if (/^[0-9a-fA-F]{64}$/.test(q)) {
      // TXID로 먼저 시도 (mempool.space API에서 판별)
      onSearchTx?.({ txid: q });
      setQuery('');
      return;
    }

    // 비트코인 주소 (bc1, 1, 3으로 시작)
    if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(q)) {
      onSearchAddress?.(q);
      setQuery('');
      return;
    }

    setError('유효한 블록 높이, TXID, 또는 주소를 입력하세요');
  }, [query, onSearchBlock, onSearchTx, onSearchAddress]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') {
      setQuery('');
      setFocused(false);
      e.target.blur();
    }
  }, [handleSearch]);

  return (
    <div className="relative">
      <div className={`flex items-center gap-1.5 bg-panel-bg-light
                      border rounded-md px-2.5 py-1.5 transition-all duration-200
                      ${focused ? 'border-btc-orange w-[280px] md:w-[320px]' : 'border-btc-orange/30 w-[180px] md:w-[220px]'}`}>
        <span className="text-btc-orange/50 text-sm shrink-0" aria-hidden="true">⌕</span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(''); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="블록, TX, 주소 검색…"
          className="bg-transparent border-none outline-none text-btc-orange text-xs
                    font-mono w-full placeholder:text-btc-orange/25"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setError(''); }}
            aria-label="검색어 지우기"
            className="text-muted text-xs cursor-pointer bg-transparent border-none hover:text-btc-orange"
          >
            ✕
          </button>
        )}
      </div>

      {/* 검색 힌트 */}
      {focused && !query && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-panel-bg-solid
                       border border-btc-orange/20 rounded-md px-3 py-2 z-20
                       text-xs text-muted font-mono">
          <div className="mb-1 text-btc-orange/60 text-[10px]">검색 예시:</div>
          <div className="text-text-dim">840000 — 블록 높이</div>
          <div className="text-text-dim">0000...abcd — TXID / 블록 해시</div>
          <div className="text-text-dim">bc1q... — 비트코인 주소</div>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-panel-bg-solid
                       border border-error/30 rounded-md px-3 py-1.5 z-20
                       text-[10px] text-error font-mono">
          {error}
        </div>
      )}
    </div>
  );
}
