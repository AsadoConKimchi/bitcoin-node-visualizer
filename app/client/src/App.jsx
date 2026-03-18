import React, { useState, useCallback, useEffect, useRef } from 'react';
import Universe from './canvas/Universe.jsx';
import { createDataSource } from './datasource/index.js';
import { createTxParticle, createBlockParticle } from './canvas/particles.js';
import { getPeerPositions, getNodeCenter } from './canvas/layout.js';
import SettingsPanel from './components/SettingsPanel.jsx';

const MAX_RECENT_BLOCKS = 10;

// 더미 피어 (mempool.space에 peer 정보 없음 → 고정 8개)
function makePlaceholderPeers(count, cx, cy) {
  const positions = getPeerPositions(count, cx, cy, Math.min(cx, cy) * 0.55);
  return positions.map((pos, i) => ({
    ...pos,
    active: true,
    label: `peer${i + 1}`,
  }));
}

function getCanvasDims() {
  return { w: window.innerWidth, h: window.innerHeight };
}

// localStorage 키
const LS_SOURCE_TYPE = 'bnv_sourceType';
const LS_CUSTOM_URL = 'bnv_customNodeUrl';

export default function App() {
  // 데이터 소스 설정
  const [sourceType, setSourceType] = useState(
    () => localStorage.getItem(LS_SOURCE_TYPE) || 'mempool'
  );
  const [customNodeUrl, setCustomNodeUrl] = useState(
    () => localStorage.getItem(LS_CUSTOM_URL) || ''
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 네트워크 상태
  const [mode, setMode] = useState('connecting');
  const [chain, setChain] = useState(null);
  const [blockHeight, setBlockHeight] = useState(null);
  const [mempoolCount, setMempoolCount] = useState(null);
  const [feeRate, setFeeRate] = useState(null);       // fastestFee sat/vB
  const [diffAdj, setDiffAdj] = useState(null);       // { progressPercent, remainingBlocks }
  const [txPerSec, setTxPerSec] = useState(0);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [peers] = useState(() => {
    const { w, h } = getCanvasDims();
    return makePlaceholderPeers(8, w / 2, h / 2);
  });
  const [particles, setParticles] = useState([]);
  const [nodePulsing, setNodePulsing] = useState(false);

  const peersRef = useRef(peers);
  peersRef.current = peers;

  // TX 파티클 생성 (txPerSec는 어댑터의 txPerSec 이벤트로만 관리)
  const spawnTxParticle = useCallback((txData) => {
    const { w, h } = getCanvasDims();
    const { x: cx, y: cy } = getNodeCenter(w, h);
    const currentPeers = peersRef.current;
    if (currentPeers.length === 0) return;
    const from = currentPeers[Math.floor(Math.random() * currentPeers.length)];
    const particle = createTxParticle(from, { x: cx, y: cy }, txData.txid);
    setParticles((prev) => [...prev, particle]);
  }, []);

  // 블록 파티클 생성 (모든 피어로 전파)
  const spawnBlockParticles = useCallback((blockData) => {
    const { w, h } = getCanvasDims();
    const { x: cx, y: cy } = getNodeCenter(w, h);
    const currentPeers = peersRef.current;
    const newParticles = currentPeers.map((peer) =>
      createBlockParticle({ x: cx, y: cy }, peer, blockData)
    );
    setParticles((prev) => [...prev, ...newParticles]);

    // 노드 펄스
    setNodePulsing(true);
    setTimeout(() => setNodePulsing(false), 3000);
  }, []);

  // 블록 도착 파티클 (피어 → 중심 노드)
  const spawnBlockArrivalParticle = useCallback((blockData) => {
    const { w, h } = getCanvasDims();
    const { x: cx, y: cy } = getNodeCenter(w, h);
    const currentPeers = peersRef.current;
    if (currentPeers.length === 0) return;
    const from = currentPeers[Math.floor(Math.random() * currentPeers.length)];
    const particle = createBlockParticle(from, { x: cx, y: cy }, blockData);
    setParticles((prev) => [...prev, particle]);
  }, []);

  // 데이터 소스 구독 useEffect
  useEffect(() => {
    // 소스 전환 시 연결 중 상태로 초기화
    setMode('connecting');

    const ds = createDataSource(sourceType, { url: customNodeUrl });
    const unsubs = [];

    unsubs.push(ds.subscribe('__connected', () =>
      setMode(sourceType === 'electrum' ? 'electrum' : 'live')
    ));
    unsubs.push(ds.subscribe('__disconnected', () => setMode('error')));

    unsubs.push(ds.subscribe('init', (data) => {
      if (data.chain) setChain(data.chain);
      if (data.blocks != null) setBlockHeight(data.blocks);
      if (data.recentBlocks?.length) setRecentBlocks(data.recentBlocks.slice(0, MAX_RECENT_BLOCKS));
    }));

    unsubs.push(ds.subscribe('tx', (data) => spawnTxParticle(data)));

    // txPerSec는 어댑터에서 emit하는 값만 사용 (이중 계산 제거)
    unsubs.push(ds.subscribe('txPerSec', ({ value }) => setTxPerSec(value)));

    unsubs.push(ds.subscribe('block:received', (data) => {
      if (data.height != null) setBlockHeight(data.height);
      spawnBlockArrivalParticle(data);
    }));

    unsubs.push(ds.subscribe('block:validated', (data) => {
      // minedCount가 포함된 블록 데이터를 recentBlocks에 추가
      setRecentBlocks((prev) => [data, ...prev].slice(0, MAX_RECENT_BLOCKS));
    }));

    unsubs.push(ds.subscribe('block:propagated', (data) => {
      spawnBlockParticles(data);
    }));

    unsubs.push(ds.subscribe('block:mined', ({ count }) => {
      // mined TX 수는 block:validated 이벤트의 minedCount 필드로 이미 전달됨
      // 여기서는 별도 처리 불필요 (로그만)
      console.log(`[App] ${count} txs confirmed in block`);
    }));

    unsubs.push(ds.subscribe('mempool', ({ count }) => setMempoolCount(count)));

    unsubs.push(ds.subscribe('fees', ({ fastestFee }) => setFeeRate(fastestFee)));

    unsubs.push(ds.subscribe('difficulty', (da) => setDiffAdj(da)));

    // removed/replaced TX는 mempool 카운트가 mempoolInfo로 자동 갱신되므로 별도 처리 불필요
    unsubs.push(ds.subscribe('tx:removed', ({ count }) => {
      console.log(`[App] ${count} txs removed from mempool`);
    }));
    unsubs.push(ds.subscribe('tx:replaced', ({ count }) => {
      console.log(`[App] ${count} txs replaced (RBF)`);
    }));

    return () => {
      unsubs.forEach((u) => u());
      ds.destroy();
    };
  }, [sourceType, customNodeUrl, spawnTxParticle, spawnBlockParticles, spawnBlockArrivalParticle]);

  // 설정 저장 + 소스 전환
  const handleConnect = useCallback((newType, newUrl) => {
    localStorage.setItem(LS_SOURCE_TYPE, newType);
    localStorage.setItem(LS_CUSTOM_URL, newUrl);
    setSourceType(newType);
    setCustomNodeUrl(newUrl);
    setSettingsOpen(false);
    // 상태 초기화 (mode는 useEffect에서 'connecting'으로 설정)
    setRecentBlocks([]);
    setMempoolCount(null);
    setFeeRate(null);
    setDiffAdj(null);
    setTxPerSec(0);
  }, []);

  const handleParticlesUpdate = useCallback((updated) => {
    setParticles(updated);
  }, []);

  const appState = {
    mode,
    chain,
    blockHeight,
    mempoolCount,
    feeRate,
    diffAdj,
    txPerSec,
    recentBlocks,
    peers,
    particles,
    nodePulsing,
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Universe
        state={appState}
        onParticlesUpdate={handleParticlesUpdate}
      />

      {/* 설정 버튼 (우하단) */}
      <button
        onClick={() => setSettingsOpen(true)}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid #f7931a',
          borderRadius: 6,
          color: '#f7931a',
          fontFamily: "'Courier New', monospace",
          fontSize: 12,
          padding: '8px 14px',
          cursor: 'pointer',
          zIndex: 5,
        }}
      >
        ⚙ Node Settings
      </button>

      {/* 설정 패널 */}
      {settingsOpen && (
        <SettingsPanel
          sourceType={sourceType}
          customNodeUrl={customNodeUrl}
          onConnect={handleConnect}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
