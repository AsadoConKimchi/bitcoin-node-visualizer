import React, { forwardRef } from 'react';

const STATUS_COLOR = {
  live: 'text-success',
  electrum: 'text-success',
  connecting: 'text-orange-500',
  error: 'text-error',
};

const STATUS_LABEL = {
  live: '● LIVE',
  electrum: '● ELECTRUM',
  connecting: '◌ CONNECTING',
  error: '○ DISCONNECTED',
};

const SERVER_MODE_SUFFIX = {
  zmq: ' (ZMQ)',
  rpc: ' (RPC)',
  error: null,
};

function Row({ label, value, valueColor }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-text-secondary shrink-0">{label}</span>
      <span className={`font-mono ${valueColor || 'text-text-primary'}`}>{value ?? '—'}</span>
    </div>
  );
}

const HudPanels = forwardRef(function HudPanels({ mode, serverMode, chain, blockHeight, mempoolCount, feeRate, halfHourFee, hourFee, diffAdj, txPerSec, visible, compact, sourceType, mempoolInfo, nodeInfo, utxoStats, bestBlockHash, minimized, onClose, onMinimize, onExpand }, ref) {
  if (!visible) return null;

  const effectiveMode = serverMode === 'error' ? 'error' : mode;
  const dotColorClass = STATUS_COLOR[effectiveMode] || 'text-orange-500';
  let statusLabel = STATUS_LABEL[effectiveMode] || '◌ …';

  if (effectiveMode === 'live' && serverMode && SERVER_MODE_SUFFIX[serverMode] != null) {
    statusLabel = '● LIVE' + SERVER_MODE_SUFFIX[serverMode];
  } else if (serverMode === 'error') {
    statusLabel = '✗ NODE DOWN';
  }

  // 데이터소스 배지
  const isServer = sourceType === 'server';
  let sourceBadge, sourceSubtitle;
  if (isServer) {
    const modeSuffix = serverMode === 'zmq' ? ' (ZMQ/RPC)' : serverMode === 'rpc' ? ' (RPC)' : '';
    sourceBadge = `🖥️ MY FULL NODE${modeSuffix}`;
    sourceSubtitle = '자체 풀노드 데이터';
  } else {
    sourceBadge = '📡 mempool.space';
    sourceSubtitle = '공개 API (교육용)';
  }

  // ── 컴팩트 모드: 핵심 정보만 1-2줄 ──
  if (compact) {
    const heightStr = blockHeight != null ? `#${blockHeight.toLocaleString()}` : '—';
    const feeStr = feeRate != null ? `${feeRate} sat/vB` : '—';
    const mempStr = mempoolCount != null ? `${mempoolCount.toLocaleString()} TX` : '—';

    return (
      <div className="absolute top-14 left-4 bg-panel-bg border border-white/8
                      rounded-xl px-3 py-2 text-xs text-text-primary
                      backdrop-blur-[20px] z-8 min-w-[200px]
                      max-sm:left-2 max-sm:min-w-[170px]"
           style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-[10px] tracking-wide">▸ NODE</span>
          <span className={`text-[10px] font-mono ${dotColorClass}`}>{statusLabel}</span>
        </div>
        <div className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide mb-1
                         ${isServer
                           ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                           : 'bg-slate-500/15 border border-slate-500/25 text-slate-400'
                         }`}>
          {sourceBadge}
        </div>
        <div className="text-[9px] text-muted mb-0.5">{sourceSubtitle}</div>
        <div className="flex gap-3 text-[11px]">
          <span>{heightStr}</span>
          <span className="text-text-dim">·</span>
          <span>{feeStr}</span>
          <span className="text-text-dim">·</span>
          <span>{mempStr}</span>
        </div>
      </div>
    );
  }

  // ── 풀 모드 ──
  const diffStr = diffAdj != null
    ? (() => {
        let s = `${diffAdj.progressPercent?.toFixed(1) ?? '?'}% (${diffAdj.remainingBlocks ?? '?'} blk)`;
        if (diffAdj.estimatedChange != null) {
          const sign = diffAdj.estimatedChange >= 0 ? '+' : '';
          s += ` ${sign}${diffAdj.estimatedChange}%`;
        }
        return s;
      })()
    : null;

  let mempoolStr = mempoolCount != null ? `${mempoolCount.toLocaleString()} TX` : null;
  if (sourceType === 'server' && mempoolInfo) {
    const usedMB = mempoolInfo.bytes != null ? (mempoolInfo.bytes / 1e6).toFixed(0) : null;
    const maxMB = mempoolInfo.maxmempool != null ? (mempoolInfo.maxmempool / 1e6).toFixed(0) : null;
    if (usedMB != null && maxMB != null && mempoolCount != null) {
      mempoolStr = `${mempoolCount.toLocaleString()} tx (${usedMB}/${maxMB} MB)`;
    }
  }

  let peersStr = null;
  if (nodeInfo?.connections != null) {
    if (nodeInfo.peerTypes) {
      const pt = nodeInfo.peerTypes;
      peersStr = `${nodeInfo.outbound ?? '?'}↑ ${nodeInfo.inbound ?? '?'}↓`;
      const parts = [];
      if (pt.fullRelay) parts.push(`FR:${pt.fullRelay}`);
      if (pt.blockRelayOnly) parts.push(`BR:${pt.blockRelayOnly}`);
      if (pt.feeler) parts.push(`F:${pt.feeler}`);
      if (parts.length) peersStr += ` (${parts.join(' ')})`;
    } else {
      peersStr = `${nodeInfo.connections}`;
    }
  }

  let securityStr = null;
  if (sourceType === 'server' && nodeInfo?.v2Transport != null) {
    const parts = [`v2:${nodeInfo.v2Transport}`];
    if (nodeInfo.torPeers != null) parts.push(`Tor:${nodeInfo.torPeers}`);
    if (nodeInfo.i2pPeers != null) parts.push(`I2P:${nodeInfo.i2pPeers}`);
    securityStr = parts.join(' ');
  }

  let timeStr = null;
  let timeColor = 'text-text-primary';
  if (sourceType === 'server' && nodeInfo?.medianTimeOffset != null) {
    const offset = nodeInfo.medianTimeOffset;
    const sign = offset >= 0 ? '+' : '';
    timeStr = `${sign}${offset}s`;
    if (Math.abs(offset) > 4200) timeColor = 'text-error';
  }

  const isIBD = sourceType === 'server' && nodeInfo?.verificationProgress != null && nodeInfo.verificationProgress < 0.9999;

  // 최소화 모드
  if (minimized) {
    const heightStr = blockHeight != null ? `#${blockHeight.toLocaleString()}` : '—';

    return (
      <div ref={ref} className="absolute top-14 left-4 bg-panel-bg border border-white/8
                      rounded-xl px-3.5 py-2.5 text-sm text-text-primary
                      backdrop-blur-[20px] min-w-[240px] z-8
                      max-sm:left-2 max-sm:min-w-[200px]"
           style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
        <div className="flex items-center gap-1.5">
          <span className="traffic-light traffic-light--close" title="닫기" onClick={onClose} />
          <span className="traffic-light traffic-light--minimize" title="최소화" onClick={onMinimize} />
          <span className="traffic-light traffic-light--expand" title="확장" onClick={onExpand} />
          <span className="font-bold text-xs tracking-wide ml-2">▸ NODE INFO</span>
          <span className={`text-xs font-mono ml-auto ${dotColorClass}`}>{statusLabel}</span>
        </div>
        <div className="text-[10px] text-muted mt-1">{heightStr} · {mempoolCount != null ? `${mempoolCount.toLocaleString()} TX` : '—'}</div>
      </div>
    );
  }

  return (
    <div ref={ref} className="absolute top-14 left-4 bg-panel-bg border border-white/8
                    rounded-xl px-3.5 py-2.5 text-sm text-text-primary
                    backdrop-blur-[20px] leading-7 min-w-[240px] z-8
                    lg:top-14 md:top-14 sm:top-14
                    max-sm:left-2 max-sm:min-w-[200px] max-sm:text-xs max-sm:leading-6"
         style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
      {/* 신호등 헤더 */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="traffic-light traffic-light--close" title="닫기" onClick={onClose} />
        <span className="traffic-light traffic-light--minimize" title="최소화" onClick={onMinimize} />
        <span className="traffic-light traffic-light--expand" title="확장" onClick={onExpand} />
      </div>

      {/* IBD 배너 */}
      {isIBD && (
        <div className="bg-yellow-900 border border-yellow-500 rounded px-2 py-1 mb-2
                       text-xs text-yellow-300 text-center">
          ⟳ SYNCING — {(nodeInfo.verificationProgress * 100).toFixed(1)}%
          {blockHeight != null && nodeInfo?.peerCount != null && (
            <span className="text-yellow-500/60"> (블록 {blockHeight.toLocaleString()})</span>
          )}
        </div>
      )}

      {/* 연결 상태 헤더 */}
      <div className="flex justify-between items-center mb-1 pb-1.5 border-b border-white/10">
        <span className="font-bold text-xs tracking-wide">▸ NODE INFO</span>
        <span className={`text-xs font-mono ${dotColorClass}`}>{statusLabel}</span>
      </div>

      {/* 데이터소스 배지 */}
      <div className={`inline-block px-2 py-1 rounded text-xs font-bold tracking-wide mb-1
                       ${isServer
                         ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                         : 'bg-slate-500/15 border border-slate-500/25 text-slate-400'
                       }`}>
        {sourceBadge}
      </div>
      <div className="text-[10px] text-muted mb-1">{sourceSubtitle}</div>
      {/* mempool 모드: 기본 위치 표시 */}
      {!isServer && (
        <div className="text-[10px] text-white/40 mb-0.5">📍 Seoul (default)</div>
      )}

      {/* 노드 신원 정보 (서버 모드) */}
      {isServer && nodeInfo?.subversion && (
        <div className="text-[10px] text-white/50 mb-0.5">
          {nodeInfo.subversion.replace(/\//g, '')}
          {' · '}{nodeInfo.connections ?? '?'} peers
          {nodeInfo.inbound != null && ` (${nodeInfo.outbound}↑ ${nodeInfo.inbound}↓)`}
        </div>
      )}
      {isServer && bestBlockHash && (
        <div className="text-[10px] text-white/30 font-mono truncate mb-1.5" title={bestBlockHash}>
          tip: {bestBlockHash.slice(0, 16)}…
        </div>
      )}
      {!isServer && mode === 'connecting' && (
        <div className="text-[10px] text-white/30 mb-1.5">⟳ 서버 감지 중...</div>
      )}

      {/* 네트워크 데이터 */}
      <Row label="Chain"   value={chain ?? 'mainnet'} />
      <Row label="Height"  value={blockHeight != null ? `#${blockHeight.toLocaleString()}` : null} />
      <Row label="Fee"     value={
        feeRate != null
          ? halfHourFee != null
            ? `${feeRate}/${halfHourFee}/${hourFee} sat/vB`
            : `${feeRate} sat/vB`
          : null
      } />
      <Row label="Mempool" value={mempoolStr} />
      {sourceType === 'server' && mempoolInfo?.mempoolminfee != null && (
        <Row label="Min Fee" value={`${(mempoolInfo.mempoolminfee * 1e5).toFixed(1)} sat/vB`} />
      )}
      {diffStr && <Row label="Diff Adj" value={diffStr} />}
      {peersStr != null && <Row label="Peers" value={peersStr} />}
      {isServer && peersStr != null && (
        <div className="text-[9px] text-white/30 -mt-1 mb-0.5 pl-1">🟢 피어 · 🟠 연결선</div>
      )}
      {securityStr && <Row label="Security" value={securityStr} />}
      {timeStr && <Row label="Time Δ" value={timeStr} valueColor={timeColor} />}
      {sourceType === 'server' && nodeInfo?.localServices?.length > 0 && (
        <Row label="Services" value={nodeInfo.localServices.join(' ')} />
      )}
      {utxoStats?.txouts != null && (
        <Row label="UTXOs" value={utxoStats.txouts.toLocaleString()} />
      )}
      {utxoStats?.diskSize != null && (
        <Row label="UTXO Size" value={`${(utxoStats.diskSize / 1e9).toFixed(1)} GB`} />
      )}
      <Row label="TX/s" value={txPerSec != null ? txPerSec.toFixed(1) : null} />
    </div>
  );
});

export default HudPanels;
