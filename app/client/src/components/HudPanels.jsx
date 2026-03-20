import React, { forwardRef, useState } from 'react';
import MacWindow from './MacWindow.jsx';

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

const HudPanels = forwardRef(function HudPanels({
  mode, serverMode, chain, blockHeight, mempoolCount, feeRate, halfHourFee, hourFee,
  diffAdj, txPerSec, visible, sourceType, mempoolInfo, nodeInfo, utxoStats, bestBlockHash,
  minimized, onClose, onMinimize, zIndex, onFocus,
}, ref) {
  if (!visible) return null;

  const effectiveMode = serverMode === 'error' ? 'error' : mode;
  const dotColorClass = STATUS_COLOR[effectiveMode] || 'text-orange-500';
  let statusLabel = STATUS_LABEL[effectiveMode] || '◌ …';

  if (effectiveMode === 'live' && serverMode && SERVER_MODE_SUFFIX[serverMode] != null) {
    statusLabel = '● LIVE' + SERVER_MODE_SUFFIX[serverMode];
  } else if (serverMode === 'error') {
    statusLabel = '✗ NODE DOWN';
  }

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

  // 값 계산
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

  // 컴팩트/확장 모드
  const [expanded, setExpanded] = useState(false);

  return (
    <MacWindow
      title="NODE INFO"
      titleColor="text-text-primary"
      initialPosition={{ x: 16, y: 56 }}
      onClose={onClose}
      onMinimize={onMinimize}
      minimized={minimized}
      zIndex={zIndex}
      onFocus={onFocus}
      width={260}
      headerRight={
        <span className={`text-xs font-mono ${dotColorClass}`}>{statusLabel}</span>
      }
    >
      <div ref={ref} className="px-3.5 py-2.5 text-sm leading-7 overflow-y-auto">
        {/* IBD 배너 */}
        {isIBD && (
          <div className="bg-yellow-900 border border-yellow-500 rounded px-2 py-1 mb-2
                         text-xs text-yellow-300 text-center">
            ⟳ SYNCING — {(nodeInfo.verificationProgress * 100).toFixed(1)}%
            {blockHeight != null && (
              <span className="text-yellow-500/60"> (블록 {blockHeight.toLocaleString()})</span>
            )}
          </div>
        )}

        {/* 데이터소스 배지 */}
        <div className={`inline-block px-2 py-1 rounded text-xs font-bold tracking-wide mb-1
                         ${isServer
                           ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                           : 'bg-slate-500/15 border border-slate-500/25 text-slate-400'
                         }`}>
          {sourceBadge}
        </div>
        <div className="text-[11px] text-muted mb-1">{sourceSubtitle}</div>
        {!isServer && (
          <div className="text-[11px] text-white/40 mb-0.5">📍 Seoul (default)</div>
        )}

        {/* 노드 정보 (서버 모드) */}
        {isServer && nodeInfo?.subversion && (
          <div className="text-[11px] text-white/50 mb-0.5">
            {nodeInfo.subversion.replace(/\//g, '')}
            {' · '}{nodeInfo.connections ?? '?'} peers
            {nodeInfo.inbound != null && ` (${nodeInfo.outbound}↑ ${nodeInfo.inbound}↓)`}
          </div>
        )}
        {isServer && bestBlockHash && (
          <div className="text-[11px] text-white/30 font-mono truncate mb-1.5" title={bestBlockHash}>
            tip: {bestBlockHash.slice(0, 16)}…
          </div>
        )}
        {!isServer && mode === 'connecting' && (
          <div className="text-[11px] text-white/30 mb-1.5">⟳ 서버 감지 중...</div>
        )}

        {/* 기본 행 (컴팩트) */}
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
        {peersStr != null && <Row label="Peers" value={peersStr} />}
        {isServer && peersStr != null && (
          <div className="text-[11px] text-white/30 -mt-1 mb-0.5 pl-1">🟢 피어 · 🟠 연결선</div>
        )}
        <Row label="TX/s" value={txPerSec != null ? txPerSec.toFixed(1) : null} />

        {/* 확장 토글 */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-left text-[11px] text-text-dim hover:text-text-secondary
                     cursor-pointer bg-transparent border-none mt-1 py-0.5"
        >
          {expanded ? '▾ 접기' : '▸ 상세'}
        </button>

        {/* 확장 행 */}
        {expanded && (
          <>
            {sourceType === 'server' && mempoolInfo?.mempoolminfee != null && (
              <Row label="Min Fee" value={`${(mempoolInfo.mempoolminfee * 1e5).toFixed(1)} sat/vB`} />
            )}
            {diffStr && <Row label="Diff Adj" value={diffStr} />}
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
          </>
        )}
      </div>
    </MacWindow>
  );
});

export default HudPanels;
