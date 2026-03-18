import React, { useState, useCallback, useEffect, useRef } from 'react';
import Universe from './canvas/Universe.jsx';
import { subscribe } from './ws.js';
import { createTxParticle, createBlockParticle } from './canvas/particles.js';
import { getPeerPositions, getNodeCenter } from './canvas/layout.js';

const MAX_RECENT_BLOCKS = 10;
const MAX_PEERS_DISPLAY = 12;

// 최초 더미 피어 (RPC 연결 전 시각화용)
function makePlaceholderPeers(count, cx, cy) {
  const positions = getPeerPositions(count, cx, cy, Math.min(cx, cy) * 0.55);
  return positions.map((pos, i) => ({
    ...pos,
    active: false,
    label: `peer${i + 1}`,
  }));
}

function getCanvasDims() {
  return { w: window.innerWidth, h: window.innerHeight };
}

export default function App() {
  const [mode, setMode] = useState('error');
  const [chain, setChain] = useState(null);
  const [blockHeight, setBlockHeight] = useState(null);
  const [peerCount, setPeerCount] = useState(null);
  const [mempoolCount, setMempoolCount] = useState(null);
  const [syncPct, setSyncPct] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [peers, setPeers] = useState(() => {
    const { w, h } = getCanvasDims();
    return makePlaceholderPeers(8, w / 2, h / 2);
  });
  const [particles, setParticles] = useState([]);
  const [nodePulsing, setNodePulsing] = useState(false);

  const peersRef = useRef(peers);
  peersRef.current = peers;

  // 피어 목록 업데이트 (peerCount 변경 시)
  useEffect(() => {
    if (peerCount == null) return;
    const count = Math.min(peerCount, MAX_PEERS_DISPLAY);
    const { w, h } = getCanvasDims();
    const { x: cx, y: cy } = getNodeCenter(w, h);
    const positions = getPeerPositions(count, cx, cy, Math.min(cx, cy) * 0.55);
    setPeers(
      positions.map((pos, i) => ({
        ...pos,
        active: true,
        label: `peer${i + 1}`,
      }))
    );
  }, [peerCount]);

  // TX 파티클 생성
  const spawnTxParticle = useCallback((txData) => {
    const { w, h } = getCanvasDims();
    const { x: cx, y: cy } = getNodeCenter(w, h);
    const peers = peersRef.current;
    if (peers.length === 0) return;
    const from = peers[Math.floor(Math.random() * peers.length)];
    const particle = createTxParticle(from, { x: cx, y: cy }, txData.txid);
    setParticles((prev) => [...prev, particle]);
  }, []);

  // 블록 파티클 생성 (모든 피어로 전파)
  const spawnBlockParticles = useCallback((blockData) => {
    const { w, h } = getCanvasDims();
    const { x: cx, y: cy } = getNodeCenter(w, h);
    const peers = peersRef.current;
    const newParticles = peers.map((peer) =>
      createBlockParticle({ x: cx, y: cy }, peer, blockData)
    );
    setParticles((prev) => [...prev, ...newParticles]);

    // 노드 펄스
    setNodePulsing(true);
    setTimeout(() => setNodePulsing(false), 3000);
  }, []);

  // WebSocket 이벤트 구독
  useEffect(() => {
    const unsubs = [];

    unsubs.push(subscribe('__connected', () => setMode('rpc')));
    unsubs.push(subscribe('__disconnected', () => setMode('error')));

    unsubs.push(subscribe('status', ({ mode }) => setMode(mode)));

    unsubs.push(subscribe('connected', ({ mode }) => setMode(mode)));

    unsubs.push(
      subscribe('init', (data) => {
        if (data.chain) setChain(data.chain);
        if (data.blocks != null) setBlockHeight(data.blocks);
        if (data.mode) setMode(data.mode);
      })
    );

    unsubs.push(
      subscribe('tx', (data) => {
        spawnTxParticle(data);
      })
    );

    unsubs.push(
      subscribe('block:received', (data) => {
        if (data.height != null) setBlockHeight(data.height);
      })
    );

    unsubs.push(
      subscribe('block:validated', (data) => {
        setRecentBlocks((prev) => [data, ...prev].slice(0, MAX_RECENT_BLOCKS));
      })
    );

    unsubs.push(
      subscribe('block:propagated', (data) => {
        spawnBlockParticles(data);
      })
    );

    unsubs.push(
      subscribe('mempool', ({ count }) => setMempoolCount(count))
    );

    return () => unsubs.forEach((u) => u());
  }, [spawnTxParticle, spawnBlockParticles]);

  // 주기적 REST 폴링 (피어 수, sync 진행도)
  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await fetch('/api/info');
        if (!res.ok) return;
        const data = await res.json();
        if (data.peerCount != null) setPeerCount(data.peerCount);
        if (data.verificationProgress != null) setSyncPct(data.verificationProgress);
        if (data.chain) setChain(data.chain);
        if (data.blocks != null) setBlockHeight(data.blocks);
        if (data.mode) setMode(data.mode);
      } catch {}
    }

    fetchInfo();
    const timer = setInterval(fetchInfo, 15_000);
    return () => clearInterval(timer);
  }, []);

  const handleParticlesUpdate = useCallback((updated) => {
    setParticles(updated);
  }, []);

  const appState = {
    mode,
    chain,
    blockHeight,
    peerCount,
    mempoolCount,
    syncPct,
    recentBlocks,
    peers,
    particles,
    nodePulsing,
  };

  return (
    <Universe
      state={appState}
      onParticlesUpdate={handleParticlesUpdate}
    />
  );
}
