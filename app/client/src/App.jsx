import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import GlobeScene from './globe/GlobeScene.jsx';
import { NodeDataManager, MY_NODE } from './globe/nodeData.js';
import { createDataSource } from './datasource/index.js';
import { BlockVerificationState } from './verification/BlockVerificationState.js';
import { TxVerificationState } from './verification/TxVerificationState.js';
import ToggleBar from './components/ToggleBar.jsx';
import SearchBar from './components/SearchBar.jsx';
import HudPanels from './components/HudPanels.jsx';
import TxStreamPanel from './components/TxStreamPanel.jsx';
import BlockVerifyPanel from './components/BlockVerifyPanel.jsx';
import BitfeedFloor from './components/BitfeedFloor.jsx';
import WindowDock from './components/WindowDock.jsx';
import MempoolBlocksPanel from './components/MempoolBlocksPanel.jsx';
import TxDetailPanel from './components/TxDetailPanel.jsx';
import ChainStrip from './components/ChainStrip.jsx';
import BlockDetailPanel from './components/BlockDetailPanel.jsx';
import AddressDetailPanel from './components/AddressDetailPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import ChainTipsPanel from './components/ChainTipsPanel.jsx';
import NodeInternalsPanel from './components/NodeInternalsPanel.jsx';
import CompactBlockPanel from './components/CompactBlockPanel.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';

const MAX_RECENT_BLOCKS = 10;
const ARC_LIFETIME_MS = 3000;
const RING_LIFETIME_MS = 2000;
const RING_THROTTLE_MS = 300;
const TX_BUFFER_MAX = 60;
const TX_STREAM_MAX = 20;
const TX_ARC_THROTTLE_MS = 500;
const LS_SOURCE_TYPE = 'bnv_sourceType';
const LS_SERVER_URL = 'bnv_serverUrl';

const REST_BASE = 'https://mempool.space/api';

let _arcId = 0;
let _ringId = 0;

function pickRandom(arr, n) {
  if (!arr?.length) return [];
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(arr[Math.floor(Math.random() * arr.length)]);
  }
  return result.filter(Boolean);
}

// 윈도우 z-index 베이스
const Z_BASE = 10;
const Z_FOCUSED = 15;

export default function App() {
  // ── 데이터 소스 설정 ──
  const [sourceType, setSourceType] = useState(null);
  const [serverUrl, setServerUrl] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);
  const errorTimerRef = useRef(null);

  // ── BitfeedFloor ref ──
  const bitfeedRef = useRef(null);

  // ── 마운트 시 자동 감지 ──
  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;
    let initialDone = false;

    async function checkHealth() {
      if (cancelled) return false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch('/health', { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return false;
        const json = await res.json();
        return json?.ok === true;
      } catch {
        return false;
      }
    }

    async function detect() {
      const ok = await checkHealth();
      if (cancelled) return;

      if (ok) {
        setSourceType((prev) => {
          if (prev !== 'server') return 'server';
          return prev;
        });
        setServerUrl('');
        pollTimer = setTimeout(detect, 10000);
      } else {
        if (!initialDone) {
          initialDone = true;
          const saved = localStorage.getItem(LS_SOURCE_TYPE) || 'mempool';
          const savedUrl = localStorage.getItem(LS_SERVER_URL) || '';
          setSourceType(saved === 'mynode' ? 'mempool' : saved);
          setServerUrl(savedUrl);
        }
        pollTimer = setTimeout(detect, 5000);
      }
    }

    detect();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, []);

  // ── 토글 패널 가시성 ──
  const [visible, setVisible] = useState({
    p2p: true,
    verifyCenter: false,
    internals: false,
  });

  // ── 윈도우 상태 (MacWindow 시스템) ──
  const [windowStates, setWindowStates] = useState({
    nodeInfo: { visible: true, minimized: false },
    txStream: { visible: false, minimized: false },
    blockVerify: { visible: false, minimized: false },
  });

  const [focusedWindow, setFocusedWindow] = useState(null);

  // 윈도우 상태 변경 헬퍼
  const setWinState = useCallback((key, updates) => {
    setWindowStates(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }));
  }, []);

  const focusWindow = useCallback((key) => {
    setFocusedWindow(key);
  }, []);

  const getZIndex = useCallback((key) => {
    return focusedWindow === key ? Z_FOCUSED : Z_BASE;
  }, [focusedWindow]);

  // ── HudPanels 높이 추적 ──
  const hudRef = useRef(null);
  const [hudHeight, setHudHeight] = useState(0);

  const hudVisible = windowStates.nodeInfo.visible && visible.p2p;

  useEffect(() => {
    if (!hudVisible || !hudRef.current) {
      setHudHeight(56);
      return;
    }
    const observer = new ResizeObserver(entries => {
      setHudHeight(entries[0].contentRect.height + 80);
    });
    observer.observe(hudRef.current);
    return () => observer.disconnect();
  }, [hudVisible]);

  // ── 네트워크 상태 ──
  const [mode, setMode] = useState('connecting');
  const [serverMode, setServerMode] = useState(null);
  const [chain, setChain] = useState(null);
  const [blockHeight, setBlockHeight] = useState(null);
  const [mempoolCount, setMempoolCount] = useState(null);
  const [feeRate, setFeeRate] = useState(null);
  const [halfHourFee, setHalfHourFee] = useState(null);
  const [hourFee, setHourFee] = useState(null);
  const [diffAdj, setDiffAdj] = useState(null);
  const [nodeInfo, setNodeInfo] = useState(null);
  const [txPerSec, setTxPerSec] = useState(0);
  const [bestBlockHash, setBestBlockHash] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [mempoolBlocks, setMempoolBlocks] = useState([]);
  const [mempoolInfo, setMempoolInfo] = useState(null);
  const [chaintips, setChaintips] = useState([]);
  const [utxoStats, setUtxoStats] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [securityInfo, setSecurityInfo] = useState(null);

  const recentBlocksRef = useRef([]);
  recentBlocksRef.current = recentBlocks;

  // ── CompactBlock 수동 트리거 ──
  const [forceCompactBlock, setForceCompactBlock] = useState(null);

  const handleReplayCompactBlock = useCallback(() => {
    const blocks = recentBlocksRef.current;
    if (blocks.length > 0) {
      setForceCompactBlock({ block: blocks[0], ts: Date.now() });
    }
  }, []);

  // ── 지구본 데이터 ──
  const [nodePoints, setNodePoints] = useState([MY_NODE]);
  const [eventArcs, setEventArcs] = useState([]);
  const [rings, setRings] = useState([]);
  const nodePointsRef = useRef([MY_NODE]);
  const lastRingTimeRef = useRef(0);
  const lastTxArcTimeRef = useRef(0);

  useEffect(() => {
    const mgr = new NodeDataManager((points) => {
      nodePointsRef.current = points;
      setNodePoints(points);
    }, serverUrl, sourceType === 'server');
    mgr.start();
    return () => mgr.destroy();
  }, [serverUrl, sourceType]);

  const peerArcs = useMemo(() => {
    return nodePoints
      .filter(n => n.isMyPeer)
      .map(peer => ({
        startLat: MY_NODE.lat, startLng: MY_NODE.lng,
        endLat: peer.lat, endLng: peer.lng,
        color: 'rgba(247,147,26,0.5)',
        type: 'connection',
      }));
  }, [nodePoints]);

  const combinedArcs = useMemo(() => [...peerArcs, ...eventArcs], [peerArcs, eventArcs]);

  const addArcs = useCallback((newArcs) => {
    if (!newArcs.length) return;
    const tagged = newArcs.map((a) => ({ ...a, _id: ++_arcId }));
    setEventArcs((prev) => [...prev, ...tagged]);
    setTimeout(() => {
      const ids = new Set(tagged.map((a) => a._id));
      setEventArcs((prev) => prev.filter((a) => !ids.has(a._id)));
    }, ARC_LIFETIME_MS);
  }, []);

  const addRing = useCallback((pos) => {
    const now = Date.now();
    if (now - lastRingTimeRef.current < RING_THROTTLE_MS) return;
    lastRingTimeRef.current = now;

    const tagged = [{ ...pos, _id: ++_ringId }];
    setRings((prev) => [...prev, ...tagged]);
    setTimeout(() => {
      const id = tagged[0]._id;
      setRings((prev) => prev.filter((r) => r._id !== id));
    }, RING_LIFETIME_MS);
  }, []);

  // ── 블록 검증 상태 ──
  const [blockVerifyState, setBlockVerifyState] = useState(null);
  const blockVerifyRef = useRef(null);
  const txBufferRef = useRef([]);

  const startBlockVerification = useCallback((blockData) => {
    blockVerifyRef.current?.destroy();
    const bvs = new BlockVerificationState(blockData, (state) => {
      setBlockVerifyState({ ...state });
    });
    blockVerifyRef.current = bvs;
    bvs.start();
  }, []);

  // ── TX 스트림 상태 ──
  const [txStream, setTxStream] = useState([]);
  const txStreamVerifyRefs = useRef(new Map());

  const addToTxStream = useCallback((txData) => {
    const txid = txData.txid;
    if (!txid) return;

    setTxStream((prev) => {
      if (prev.some((t) => t.txid === txid)) return prev;

      const tvs = new TxVerificationState(txData, (state) => {
        setTxStream((current) =>
          current.map((t) =>
            t.txid === txid
              ? {
                  ...t,
                  verifySnapshot: { ...state },
                  status: state.failed ? 'failed' : state.done ? 'done' : 'verifying',
                  failReason: state.failReason || null,
                }
              : t
          )
        );

        if (state.failed) {
          setTimeout(() => {
            bitfeedRef.current?.addRejected(txData);
            setTimeout(() => {
              setTxStream((current) => current.filter((t) => t.txid !== txid));
              txStreamVerifyRefs.current.get(txid)?.destroy();
              txStreamVerifyRefs.current.delete(txid);
            }, 2000);
          }, 500);
        }

        if (state.done && !state.failed) {
          setTimeout(() => {
            setTxStream((current) =>
              current.map((t) => t.txid === txid ? { ...t, status: 'animating' } : t)
            );
            setTimeout(() => {
              bitfeedRef.current?.addBlock(txData);
              setTxStream((current) => current.filter((t) => t.txid !== txid));
              txStreamVerifyRefs.current.get(txid)?.destroy();
              txStreamVerifyRefs.current.delete(txid);
            }, 500);
          }, 500);
        }
      });

      txStreamVerifyRefs.current.set(txid, tvs);
      tvs.start();

      const entry = {
        txid,
        data: txData,
        verifySnapshot: tvs.getState(),
        status: 'verifying',
        failReason: null,
        enterTime: Date.now(),
      };

      const next = [entry, ...prev].slice(0, TX_STREAM_MAX);
      return next;
    });
  }, []);

  // ── TX/블록/주소 상세 패널 ──
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);

  // verifyCenter 토글 → 검증 패널 ON/OFF + 블록 검증 시작
  const handleToggle = useCallback((key) => {
    setVisible((prev) => {
      // 라디오 모드: 이미 활성이면 끄기, 아니면 해당 키만 활성
      const turning = !prev[key];
      const next = { p2p: false, verifyCenter: false, internals: false };
      if (turning) next[key] = true;

      // 검증 패널 동시 제어
      setWindowStates(ws => ({
        ...ws,
        txStream: { ...ws.txStream, visible: next.verifyCenter },
        blockVerify: { ...ws.blockVerify, visible: next.verifyCenter },
        // P2P 모드일 때만 NODE INFO 표시
        nodeInfo: { ...ws.nodeInfo, visible: next.p2p },
      }));

      if (next.verifyCenter) {
        const blocks = recentBlocksRef.current;
        if (blocks.length > 0) {
          setTimeout(() => startBlockVerification(blocks[0]), 50);
        } else {
          setTimeout(() => startBlockVerification({
            height: 0,
            hash: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff666677778888' + '99990000',
            txCount: 2847,
            pool: 'Demo',
          }), 50);
        }
      }

      return next;
    });
  }, [startBlockVerification]);

  // ── 검색 핸들러 ──
  const handleSearchBlock = useCallback((query) => {
    if (query.height != null) {
      fetch(`${REST_BASE}/block-height/${query.height}`)
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(hash => setSelectedBlock({ height: query.height, hash }))
        .catch(() => console.warn('블록 조회 실패:', query.height));
    }
  }, []);

  const handleSearchTx = useCallback((query) => {
    if (query.txid) {
      fetch(`${REST_BASE}/tx/${query.txid}`)
        .then(r => {
          if (r.ok) {
            setSelectedTx({ txid: query.txid, data: {} });
          } else {
            return fetch(`${REST_BASE}/block/${query.txid}`)
              .then(r2 => r2.ok ? r2.json() : Promise.reject())
              .then(block => setSelectedBlock({ height: block.height, hash: query.txid }));
          }
        })
        .catch(() => console.warn('TX/블록 조회 실패:', query.txid));
    }
  }, []);

  const handleSearchAddress = useCallback((address) => {
    setSelectedAddress(address);
  }, []);

  // ── 데이터 소스 구독 ──
  useEffect(() => {
    if (sourceType === null) return;

    setMode('connecting');
    setServerMode(null);
    setShowErrorOverlay(false);

    const ds = createDataSource(sourceType, {
      url: sourceType === 'server' ? serverUrl : '',
    });
    const unsubs = [];

    unsubs.push(ds.subscribe('__disconnected', () => {
      setMode('error');
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setShowErrorOverlay(true), 5000);
    }));

    unsubs.push(ds.subscribe('__connected', (data) => {
      if (data?.mode === 'error') {
        setMode('error');
        setServerMode('error');
      } else {
        setMode('live');
        if (data?.mode) setServerMode(data.mode);
      }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      setShowErrorOverlay(false);
    }));

    unsubs.push(ds.subscribe('serverMode', (data) => {
      if (data?.mode) {
        setServerMode(data.mode);
        if (data.mode === 'error') {
          setMode('error');
        } else {
          setMode('live');
        }
      }
    }));

    unsubs.push(ds.subscribe('init', (data) => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      setShowErrorOverlay(false);
      if (data.chain) setChain(data.chain);
      if (data.blocks != null) setBlockHeight(data.blocks);
      if (data.bestBlockHash) setBestBlockHash(data.bestBlockHash);
      if (data.recentBlocks?.length) {
        setRecentBlocks(data.recentBlocks.slice(0, MAX_RECENT_BLOCKS));
        if (blockVerifyRef.current?.blockData?.height === 0) {
          startBlockVerification(data.recentBlocks[0]);
        }
      }
    }));

    unsubs.push(ds.subscribe('tx', (data) => {
      if (data.txid) {
        txBufferRef.current.push(data);
        if (txBufferRef.current.length > TX_BUFFER_MAX) txBufferRef.current.shift();
      }

      addRing({ lat: MY_NODE.lat, lng: MY_NODE.lng });

      const now = Date.now();
      if (now - lastTxArcTimeRef.current >= TX_ARC_THROTTLE_MS) {
        lastTxArcTimeRef.current = now;
        const peers = nodePointsRef.current.filter((n) => n.isMyPeer);
        if (peers.length) {
          const src = peers[Math.floor(Math.random() * peers.length)];
          const arcs = [{
            startLat: src.lat, startLng: src.lng,
            endLat: MY_NODE.lat, endLng: MY_NODE.lng,
            color: '#60a5fa', type: 'tx',
          }];

          if (sourceType !== 'server' && Math.random() < 0.3) {
            const bgNodes = nodePointsRef.current.filter((n) => !n.isMyNode && !n.isMyPeer);
            if (bgNodes.length >= 2) {
              const a = bgNodes[Math.floor(Math.random() * bgNodes.length)];
              const b = bgNodes[Math.floor(Math.random() * bgNodes.length)];
              if (a !== b) {
                arcs.push({
                  startLat: a.lat, startLng: a.lng,
                  endLat: b.lat, endLng: b.lng,
                  color: '#93c5fd', type: 'tx',
                });
              }
            }
          }

          addArcs(arcs);

          // 릴레이 전파: 내 노드 → 나머지 모든 피어
          const relayPeers = peers.filter(n => n !== src);
          if (relayPeers.length > 0) {
            setTimeout(() => {
              addArcs(relayPeers.map(p => ({
                startLat: MY_NODE.lat, startLng: MY_NODE.lng,
                endLat: p.lat, endLng: p.lng,
                color: '#93c5fd', type: 'tx',
              })));
            }, 150);
          }
        }
      }

      if (data.txid) {
        addToTxStream(data);
      }
    }));

    unsubs.push(ds.subscribe('txPerSec', ({ value }) => setTxPerSec(value)));

    unsubs.push(ds.subscribe('tx:verified', (data) => {
      if (data?.txid) {
        const tvs = txStreamVerifyRefs.current.get(data.txid);
        if (tvs) tvs.injectVerification(data);
      }
    }));

    unsubs.push(ds.subscribe('block:received', (data) => {
      if (data.height != null) setBlockHeight(data.height);

      const peers = nodePointsRef.current.filter((n) => n.isMyPeer);
      const blockSrcPeers = pickRandom(peers.length ? peers : nodePointsRef.current.filter((n) => !n.isMyNode), 4);
      addArcs(
        blockSrcPeers.map((n) => ({
          startLat: n.lat, startLng: n.lng,
          endLat: MY_NODE.lat, endLng: MY_NODE.lng,
          color: '#f7931a', type: 'block',
        }))
      );

      // 릴레이 전파: 내 노드 → 나머지 모든 피어
      const blockSrcSet = new Set(blockSrcPeers.map(n => `${n.lat},${n.lng}`));
      const blockRelayPeers = peers.filter(n => !blockSrcSet.has(`${n.lat},${n.lng}`));
      if (blockRelayPeers.length > 0) {
        setTimeout(() => {
          addArcs(blockRelayPeers.map(p => ({
            startLat: MY_NODE.lat, startLng: MY_NODE.lng,
            endLat: p.lat, endLng: p.lng,
            color: '#fbbf24', type: 'block',
          })));
        }, 200);
      }

      if (sourceType !== 'server') {
        const bgNodes = nodePointsRef.current.filter((n) => !n.isMyNode && !n.isMyPeer);
        if (bgNodes.length >= 2) {
          const propagationArcs = [];
          for (let i = 0; i < 3; i++) {
            const src = bgNodes[Math.floor(Math.random() * bgNodes.length)];
            const dst = bgNodes[Math.floor(Math.random() * bgNodes.length)];
            if (src !== dst) {
              propagationArcs.push({
                startLat: src.lat, startLng: src.lng,
                endLat: dst.lat, endLng: dst.lng,
                color: '#a78bfa', type: 'block',
              });
            }
          }
          if (propagationArcs.length) addArcs(propagationArcs);
        }
      }

      startBlockVerification(data);
      // 라디오 모드: 블록 수신 시 검증센터로 전환
      setVisible({ p2p: false, verifyCenter: true, internals: false });
      setWindowStates(ws => ({
        ...ws,
        nodeInfo: { ...ws.nodeInfo, visible: false },
        txStream: { ...ws.txStream, visible: true },
        blockVerify: { ...ws.blockVerify, visible: true },
      }));
    }));

    unsubs.push(ds.subscribe('block:validated', (data) => {
      setRecentBlocks((prev) => [data, ...prev].slice(0, MAX_RECENT_BLOCKS));
    }));

    unsubs.push(ds.subscribe('block:propagated', () => {
      const peers = nodePointsRef.current.filter((n) => n.isMyPeer);
      addArcs(
        pickRandom(peers.length ? peers : nodePointsRef.current.filter((n) => !n.isMyNode), 10).map((n) => ({
          startLat: MY_NODE.lat, startLng: MY_NODE.lng,
          endLat: n.lat, endLng: n.lng,
          color: '#22c55e', type: 'block',
        }))
      );
    }));

    unsubs.push(ds.subscribe('block:mined', ({ count, txids }) => {
      console.log(`[App] ${count} txs confirmed`);
      if (txids?.length) {
        bitfeedRef.current?.sweepBlocks(txids);
      }
    }));

    unsubs.push(ds.subscribe('mempool', ({ count }) => setMempoolCount(count)));
    unsubs.push(ds.subscribe('fees', (data) => {
      setFeeRate(data.fastestFee);
      setHalfHourFee(data.halfHourFee);
      setHourFee(data.hourFee);
    }));
    unsubs.push(ds.subscribe('difficulty', (da) => setDiffAdj(da)));
    unsubs.push(ds.subscribe('mempool:blocks', (blocks) => setMempoolBlocks(blocks)));

    unsubs.push(ds.subscribe('mempoolInfo', (info) => setMempoolInfo(info)));
    unsubs.push(ds.subscribe('chaintips', (tips) => setChaintips(tips)));
    unsubs.push(ds.subscribe('nodeInfo', (info) => setNodeInfo(info)));
    unsubs.push(ds.subscribe('utxoStats', (data) => setUtxoStats(data)));
    unsubs.push(ds.subscribe('storageInfo', (data) => setStorageInfo(data)));
    unsubs.push(ds.subscribe('securityInfo', (data) => setSecurityInfo(data)));

    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      unsubs.forEach((u) => u());
      ds.destroy();
      txStreamVerifyRefs.current.forEach((tvs) => tvs.destroy());
      txStreamVerifyRefs.current.clear();
    };
  }, [sourceType, serverUrl, addArcs, addRing, startBlockVerification, addToTxStream]);

  // ── 설정 저장 ──
  const handleConnect = useCallback((newType, newServerUrl) => {
    localStorage.setItem(LS_SOURCE_TYPE, newType);
    localStorage.setItem(LS_SERVER_URL, newServerUrl || '');
    setSourceType(newType);
    setServerUrl(newServerUrl || '');
    setSettingsOpen(false);
    setShowErrorOverlay(false);
    setServerMode(null);
    setRecentBlocks([]);
    setMempoolCount(null);
    setFeeRate(null);
    setHalfHourFee(null);
    setHourFee(null);
    setDiffAdj(null);
    setNodeInfo(null);
    setTxPerSec(0);
    setMempoolBlocks([]);
    setMempoolInfo(null);
    setChaintips([]);
    setUtxoStats(null);
    setStorageInfo(null);
    setSecurityInfo(null);
    txBufferRef.current = [];
    setTxStream([]);
    txStreamVerifyRefs.current.forEach((tvs) => tvs.destroy());
    txStreamVerifyRefs.current.clear();
  }, []);

  const handleBlockClick = useCallback((block) => {
    setSelectedBlock(block);
  }, []);

  const handleTxClick = useCallback((tx) => {
    setSelectedTx(tx);
  }, []);

  // ── WindowDock 최소화 아이템 ──
  const dockItems = useMemo(() => {
    const items = [];
    if (windowStates.nodeInfo.visible && windowStates.nodeInfo.minimized) {
      items.push({
        key: 'nodeInfo',
        title: 'NODE INFO',
        titleColor: 'text-text-primary',
        onRestore: () => setWinState('nodeInfo', { minimized: false }),
      });
    }
    if (windowStates.txStream.visible && windowStates.txStream.minimized) {
      items.push({
        key: 'txStream',
        title: 'TX VERIFY',
        titleColor: 'text-tx-blue',
        onRestore: () => setWinState('txStream', { minimized: false }),
      });
    }
    if (windowStates.blockVerify.visible && windowStates.blockVerify.minimized) {
      items.push({
        key: 'blockVerify',
        title: 'BLOCK VERIFY',
        titleColor: 'text-block-purple',
        onRestore: () => setWinState('blockVerify', { minimized: false }),
      });
    }
    return items;
  }, [windowStates, setWinState]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 3D 지구본 — 전체 배경 */}
      <GlobeScene nodePoints={nodePoints} arcs={combinedArcs} rings={rings} isServerMode={sourceType === 'server'} />

      {/* 상단 토글 바 */}
      <ToggleBar visible={visible} onToggle={handleToggle} />

      {/* 검색 바 */}
      <div className="absolute top-3 right-4 z-[var(--z-modal)] max-sm:right-2">
        <SearchBar
          onSearchBlock={handleSearchBlock}
          onSearchTx={handleSearchTx}
          onSearchAddress={handleSearchAddress}
        />
      </div>

      {/* 좌상단 HUD — MacWindow */}
      {windowStates.nodeInfo.visible && (
        <HudPanels
          ref={hudRef}
          visible={visible.p2p}
          mode={mode}
          serverMode={serverMode}
          chain={chain}
          blockHeight={blockHeight}
          mempoolCount={mempoolCount}
          feeRate={feeRate}
          halfHourFee={halfHourFee}
          hourFee={hourFee}
          diffAdj={diffAdj}
          txPerSec={txPerSec}
          sourceType={sourceType}
          mempoolInfo={mempoolInfo}
          nodeInfo={nodeInfo}
          utxoStats={utxoStats}
          bestBlockHash={bestBlockHash}
          minimized={windowStates.nodeInfo.minimized}
          onClose={() => setWinState('nodeInfo', { visible: false })}
          onMinimize={() => setWinState('nodeInfo', { minimized: !windowStates.nodeInfo.minimized })}
          zIndex={getZIndex('nodeInfo')}
          onFocus={() => focusWindow('nodeInfo')}
        />
      )}

      {/* 체인 분기 패널 (서버 모드, P2P 모드일 때) */}
      {sourceType === 'server' && visible.p2p && chaintips.length > 0 && (
        <ChainTipsPanel chaintips={chaintips} />
      )}

      {/* TX 검증 패널 — 독립 MacWindow */}
      <TxStreamPanel
        txStream={txStream}
        onTxClick={handleTxClick}
        visible={windowStates.txStream.visible}
        minimized={windowStates.txStream.minimized}
        onClose={() => {
          setWinState('txStream', { visible: false });
          setVisible(prev => ({ ...prev, verifyCenter: false }));
        }}
        onMinimize={() => setWinState('txStream', { minimized: !windowStates.txStream.minimized })}
        zIndex={getZIndex('txStream')}
        onFocus={() => focusWindow('txStream')}
      />

      {/* 블록 검증 패널 — 독립 MacWindow */}
      <BlockVerifyPanel
        verifyState={blockVerifyState}
        visible={windowStates.blockVerify.visible}
        minimized={windowStates.blockVerify.minimized}
        onClose={() => {
          setWinState('blockVerify', { visible: false });
          setVisible(prev => ({ ...prev, verifyCenter: false }));
        }}
        onMinimize={() => setWinState('blockVerify', { minimized: !windowStates.blockVerify.minimized })}
        zIndex={getZIndex('blockVerify')}
        onFocus={() => focusWindow('blockVerify')}
      />

      {/* BitfeedFloor — 전체 너비 하단 바 */}
      <div className="absolute bottom-0 left-0 right-0 h-[200px] z-[var(--z-strip)]"
           style={{ background: 'rgba(6, 10, 20, 0.96)' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-center px-4 py-2 shrink-0">
          <span className="text-mempool-green font-bold text-xs tracking-wide">▸ MEMPOOL FLOOR</span>
          <span className="text-muted text-label">
            {mempoolCount != null ? `${mempoolCount.toLocaleString()} TX` : '—'}
          </span>
        </div>
        {/* Canvas */}
        <div className="absolute top-8 left-0 right-0 bottom-0 px-2 pb-2">
          <BitfeedFloor ref={bitfeedRef} onTxClick={handleTxClick} />
        </div>
      </div>

      {/* 예상 블록 적층 (검증 OFF일 때) */}
      <MempoolBlocksPanel
        mempoolBlocks={mempoolBlocks}
        visible={visible.p2p && mempoolBlocks.length > 0}
        topOffset={chaintips.length > 0 ? 160 : 0}
      />

      {/* 체인 스트립 — 가로 상단 바 */}
      <ChainStrip
        recentBlocks={recentBlocks}
        onBlockClick={handleBlockClick}
        onReplayCompactBlock={handleReplayCompactBlock}
        sourceType={sourceType}
        visible={visible.p2p}
      />

      {/* 블록 상세 패널 */}
      {selectedBlock && (
        <BlockDetailPanel
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onTxClick={handleTxClick}
          sourceType={sourceType}
          onAddressClick={(addr) => { setSelectedBlock(null); setSelectedAddress(addr); }}
        />
      )}

      {/* TX 상세 패널 */}
      {selectedTx && (
        <TxDetailPanel
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          sourceType={sourceType}
          onAddressClick={(addr) => { setSelectedTx(null); setSelectedAddress(addr); }}
        />
      )}

      {/* 주소 상세 패널 */}
      {selectedAddress && (
        <AddressDetailPanel
          address={selectedAddress}
          onClose={() => setSelectedAddress(null)}
          onTxClick={handleTxClick}
        />
      )}

      {/* Node Internals 패널 */}
      {visible.internals && (
        <NodeInternalsPanel
          sourceType={sourceType}
          nodeInfo={nodeInfo}
          storageInfo={storageInfo}
          securityInfo={securityInfo}
          utxoStats={utxoStats}
          blockHeight={blockHeight}
          recentBlocks={recentBlocks}
        />
      )}

      {/* Compact Block 패널 */}
      <CompactBlockPanel
        recentBlocks={recentBlocks}
        mempoolCount={mempoolCount}
        forceReplay={forceCompactBlock}
      />

      {/* WindowDock — 최소화된 윈도우 복원 */}
      <WindowDock items={dockItems} />

      {/* 설정 버튼 */}
      <button
        onClick={() => setSettingsOpen(true)}
        aria-label="설정 열기"
        className="absolute bottom-[212px] left-5 bg-panel-bg border border-white/10
                  rounded-lg text-text-secondary text-sm px-3.5 py-2
                  cursor-pointer z-[var(--z-overlay)] hover:bg-white/10 hover:text-text-primary transition-colors
                  backdrop-blur-xl
                  max-sm:bottom-[208px] max-sm:left-3 max-sm:text-xs max-sm:px-2.5 max-sm:py-1.5"
      >
        ⚙ Settings
      </button>

      {/* 연결 실패 에러 오버레이 */}
      {showErrorOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-[var(--z-modal)]">
          <div className="bg-panel-bg-solid border border-white/10 rounded-xl px-8 py-7
                        text-text-primary text-center max-w-[320px] backdrop-blur-xl"
               style={{ boxShadow: 'var(--shadow-modal)' }}>
            <div className="text-base font-bold mb-2.5">연결 실패</div>
            <div className="text-sm text-text-secondary mb-5">
              서버에 연결할 수 없습니다. 설정을 확인하세요.
            </div>
            <div className="flex gap-2.5 justify-center">
              <button
                className="bg-btc-orange border-none rounded text-black font-bold
                          text-sm px-4 py-2 cursor-pointer hover:bg-btc-orange/90"
                onClick={() => { setShowErrorOverlay(false); setSettingsOpen(true); }}
              >
                설정 변경
              </button>
              <button
                className="bg-transparent border border-white/10 rounded text-text-secondary
                          text-sm px-4 py-2 cursor-pointer hover:border-white/20 hover:text-text-primary"
                onClick={() => handleConnect('mempool', '')}
              >
                mempool.space로 전환
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          sourceType={sourceType}
          serverUrl={serverUrl}
          onConnect={handleConnect}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* 온보딩 가이드 투어 */}
      <OnboardingTour />
    </div>
  );
}
