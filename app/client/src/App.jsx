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
import MempoolBlocksPanel from './components/MempoolBlocksPanel.jsx';
import ControlCenter, { TOGGLE_TO_TAB } from './components/ControlCenter.jsx';
import TxDetailPanel from './components/TxDetailPanel.jsx';
import ChainStrip from './components/ChainStrip.jsx';
import BlockDetailPanel from './components/BlockDetailPanel.jsx';
import AddressDetailPanel from './components/AddressDetailPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import ChainTipsPanel from './components/ChainTipsPanel.jsx';
import NodeInternalsPanel from './components/NodeInternalsPanel.jsx';
import CompactBlockPanel from './components/CompactBlockPanel.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
// import MiniHud from './components/MiniHud.jsx'; // 관제센터로 대체

// 모바일 감지 훅
function useIsMobile(breakpoint = 639) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

const MAX_RECENT_BLOCKS = 10;
const ARC_LIFETIME_MS = 3000;
const RING_LIFETIME_MS = 2000;
const RING_THROTTLE_MS = 300;
const TX_BUFFER_MAX = 60;
const TX_STREAM_MAX = 15;
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

// ── 에러 오버레이 (자동 재연결 카운트다운) ──
function ErrorOverlay({ onSettings, onFallback, onRetry }) {
  const [countdown, setCountdown] = useState(5);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    if (retryCount >= maxRetries) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setRetryCount(c => c + 1);
          onRetry();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryCount, onRetry]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-[var(--z-modal)]">
      <div className="bg-panel-bg-solid border border-white/10 rounded-xl px-8 py-7
                      text-text-primary text-center max-w-[320px] backdrop-blur-xl"
           style={{ boxShadow: 'var(--shadow-modal)' }}>
        <div className="text-base font-bold mb-2.5">연결 실패</div>
        <div className="text-sm text-text-secondary mb-3">
          서버에 연결할 수 없습니다.
        </div>
        {retryCount < maxRetries ? (
          <div className="text-xs text-btc-orange mb-5">
            {countdown}초 후 재연결 시도... ({retryCount + 1}/{maxRetries})
          </div>
        ) : (
          <div className="text-xs text-error mb-5">
            재연결 실패. 설정을 확인하세요.
          </div>
        )}
        <div className="flex gap-2.5 justify-center">
          <button
            className="bg-btc-orange border-none rounded text-black font-bold
                      text-sm px-4 py-2 cursor-pointer hover:bg-btc-orange/90"
            onClick={onSettings}
          >
            설정 변경
          </button>
          <button
            className="bg-transparent border border-white/10 rounded text-text-secondary
                      text-sm px-4 py-2 cursor-pointer hover:border-white/20 hover:text-text-primary"
            onClick={onFallback}
          >
            mempool.space로 전환
          </button>
        </div>
      </div>
    </div>
  );
}

// 윈도우 z-index 베이스
const Z_BASE = 10;
const Z_FOCUSED = 15;

// ── MempoolFloor (적응형 높이) ──
function MempoolFloor({ bitfeedRef, mempoolCount, onTxClick, sidebarWidth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const height = expanded ? 280 : 140;

  return (
    <div
      className="absolute bottom-0 left-0 z-[var(--z-strip)] transition-all duration-300"
      style={{ height, right: sidebarWidth, background: 'rgba(6, 10, 20, 0.96)' }}
    >
      {/* 헤더 */}
      <div className="flex justify-between items-center px-4 py-2 shrink-0">
        <span className="text-mempool-green font-bold text-xs tracking-wide">▸ MEMPOOL FLOOR</span>
        <div className="flex items-center gap-2">
          <span className="text-muted text-label">
            {mempoolCount != null ? `${mempoolCount.toLocaleString()} TX` : '—'}
          </span>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted hover:text-text-primary text-sm cursor-pointer
                       bg-transparent border-none transition-colors
                       min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={expanded ? '축소' : '확장'}
          >
            {expanded ? '▾' : '▴'}
          </button>
        </div>
      </div>
      {/* Canvas */}
      <div className="absolute top-8 left-0 right-0 bottom-0 px-2 pb-2">
        <BitfeedFloor ref={bitfeedRef} onTxClick={onTxClick} />
      </div>
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();

  // 모바일 검증센터: TX/Block 탭 전환
  const [mobileVerifyTab, setMobileVerifyTab] = useState('tx');

  // 지구본 로딩 상태
  const [globeReady, setGlobeReady] = useState(false);

  // aria-live 알림 (접근성)
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');

  // ── 데이터 소스 설정 ──
  const [sourceType, setSourceType] = useState(null);
  const [serverUrl, setServerUrl] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);
  const errorTimerRef = useRef(null);

  // ── BitfeedFloor ref ──
  const bitfeedRef = useRef(null);
  const chainStripRef = useRef(null);

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

  // ── 통합 관제센터 상태 ──
  const [ccTab, setCcTab] = useState('nodeInfo');
  const [ccCollapsed, setCcCollapsed] = useState(false);

  // ── 윈도우 상태 (레거시, 점진적 제거 예정) ──
  const [windowStates, setWindowStates] = useState({
    nodeInfo: { visible: true, minimized: false },
    txStream: { visible: false, minimized: false },
    blockVerify: { visible: false, minimized: false },
  });

  const [focusedWindow, setFocusedWindow] = useState(null);

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

  // ── ChainTips 높이 추적 (MempoolBlocksPanel 동적 오프셋) ──
  const chainTipsRef = useRef(null);
  const [chainTipsHeight, setChainTipsHeight] = useState(0);

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

  // ChainTips 높이 ResizeObserver (MempoolBlocksPanel 동적 오프셋)
  const chainTipsVisible = sourceType === 'server' && visible.p2p && chaintips.length > 0;
  useEffect(() => {
    if (!chainTipsVisible || !chainTipsRef.current) {
      setChainTipsHeight(0);
      return;
    }
    const observer = new ResizeObserver(entries => {
      setChainTipsHeight(entries[0].contentRect.height + 16);
    });
    observer.observe(chainTipsRef.current);
    return () => observer.disconnect();
  }, [chainTipsVisible]);

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
  const selectedBlockRef = useRef(null);
  useEffect(() => { selectedBlockRef.current = selectedBlock; }, [selectedBlock]);
  const [selectedAddress, setSelectedAddress] = useState(null);

  // verifyCenter 토글 → 검증 패널 ON/OFF + 블록 검증 시작
  const handleToggle = useCallback((key) => {
    // 관제센터 탭 연동
    if (TOGGLE_TO_TAB[key]) {
      setCcTab(TOGGLE_TO_TAB[key]);
      setCcCollapsed(false);
    }

    setVisible((prev) => {
      const turning = !prev[key];
      const next = { p2p: false, verifyCenter: false, internals: false };
      if (turning) next[key] = true;

      setWindowStates(ws => ({
        ...ws,
        txStream: { ...ws.txStream, visible: next.verifyCenter },
        blockVerify: { ...ws.blockVerify, visible: next.verifyCenter },
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
      chainStripRef.current?.scrollToHeight(query.height);
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
        setAriaAnnouncement('네트워크 연결 오류');
      } else {
        setMode('live');
        if (data?.mode) setServerMode(data.mode);
        setAriaAnnouncement('네트워크 연결됨');
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
        // 수신 즉시 멤풀 플로어에 추가 (bitfeed 스타일)
        bitfeedRef.current?.addBlock(data);
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
      if (data.height != null) {
        setBlockHeight(data.height);
        setAriaAnnouncement(`새 블록 #${data.height.toLocaleString()} 수신됨`);
      }

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

      // pending 블록 → 확정 블록 전환
      if (selectedBlockRef.current?.isPending && data.hash) {
        setSelectedBlock({ height: data.height, hash: data.hash, isPending: false });
      }

      startBlockVerification(data);
      // 블록 수신 시 검증센터로 전환 + 관제센터 블록 탭
      setVisible({ p2p: false, verifyCenter: true, internals: false });
      setCcTab('blockVerify');
      setCcCollapsed(false);
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

  // WindowDock은 관제센터로 대체됨

  // 관제센터 사이드바 폭
  const CC_WIDTH = 380;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 3D 지구본 — 전체 배경 */}
      <div className="absolute inset-0" style={{ right: ccCollapsed ? 0 : CC_WIDTH }}>
        <GlobeScene nodePoints={nodePoints} arcs={combinedArcs} rings={rings} isServerMode={sourceType === 'server'} onReady={() => setGlobeReady(true)} />
      </div>

      {/* 지구본 로딩 스피너 */}
      {!globeReady && (
        <div className="absolute inset-0 flex items-center justify-center z-[var(--z-hud)] pointer-events-none">
          <div className="text-btc-orange text-sm font-mono tracking-wider animate-pulse">
            Loading...
          </div>
        </div>
      )}

      {/* 상단 토글 바 */}
      <div className="absolute top-0 left-0 z-[var(--z-modal)] flex justify-center pt-3 pointer-events-none"
           style={{ right: ccCollapsed ? 0 : CC_WIDTH }}>
        <div className="pointer-events-auto">
          <ToggleBar visible={visible} onToggle={handleToggle} onSettingsClick={() => setSettingsOpen(true)} />
        </div>
      </div>

      {/* 검색 바 */}
      <div className="absolute top-3 z-[var(--z-modal)] max-sm:right-2"
           style={{ right: ccCollapsed ? 16 : CC_WIDTH + 16 }}>
        <SearchBar
          onSearchBlock={handleSearchBlock}
          onSearchTx={handleSearchTx}
          onSearchAddress={handleSearchAddress}
        />
      </div>

      {/* Compact Block 패널 */}
      <CompactBlockPanel
        recentBlocks={recentBlocks}
        mempoolCount={mempoolCount}
        forceReplay={forceCompactBlock}
      />

      {/* 체인 스트립 — Globe 상단 */}
      <div className="absolute top-[48px] left-0 z-[var(--z-strip)]"
           style={{ right: ccCollapsed ? 0 : CC_WIDTH }}>
        <ChainStrip
          ref={chainStripRef}
          recentBlocks={recentBlocks}
          mempoolBlocks={mempoolBlocks}
          onBlockClick={handleBlockClick}
          onReplayCompactBlock={handleReplayCompactBlock}
          sourceType={sourceType}
          visible={visible.p2p}
          isMobile={isMobile}
        />
      </div>

      {/* 예상 블록 (P2P 모드) */}
      <MempoolBlocksPanel
        mempoolBlocks={mempoolBlocks}
        visible={visible.p2p && mempoolBlocks.length > 0}
        topOffset={0}
      />

      {/* BitfeedFloor — 하단 바 (사이드바 겹침 방지) */}
      <MempoolFloor
        bitfeedRef={bitfeedRef}
        mempoolCount={mempoolCount}
        onTxClick={handleTxClick}
        sidebarWidth={ccCollapsed ? 0 : CC_WIDTH}
      />

      {/* 우측: 통합 관제센터 */}
      <div
        className="absolute top-0 bottom-0 right-0 z-[var(--z-hud)]
                   transition-[width] duration-300 ease-out overflow-hidden"
        style={{ width: ccCollapsed ? 0 : CC_WIDTH }}
      >
          <ControlCenter
            activeTab={ccTab}
            onTabChange={setCcTab}
            collapsed={ccCollapsed}
            onToggleCollapse={() => setCcCollapsed(c => !c)}
          >
            {/* 노드 정보 탭 */}
            {ccTab === 'nodeInfo' && (
              <HudPanels
                ref={hudRef}
                embedded
                visible={true}
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
              />
            )}

            {/* 블록 검증 탭 */}
            {ccTab === 'blockVerify' && (
              <BlockVerifyPanel
                embedded
                verifyState={blockVerifyState}
                visible={true}
                onBlockDetailClick={(block) => setSelectedBlock(block)}
              />
            )}

            {/* TX 검증 탭 */}
            {ccTab === 'txStream' && (
              <TxStreamPanel
                embedded
                txStream={txStream}
                onTxClick={handleTxClick}
                visible={true}
              />
            )}

            {/* 체인 팁 탭 */}
            {ccTab === 'chainTips' && (
              <ChainTipsPanel
                ref={chainTipsRef}
                chaintips={chaintips}
                embedded
              />
            )}

            {/* 내부 구조 탭 */}
            {ccTab === 'internals' && (
              <NodeInternalsPanel
                embedded
                sourceType={sourceType}
                nodeInfo={nodeInfo}
                storageInfo={storageInfo}
                securityInfo={securityInfo}
                utxoStats={utxoStats}
                blockHeight={blockHeight}
                recentBlocks={recentBlocks}
              />
            )}
          </ControlCenter>
        </div>

      {/* 블록 상세 패널 */}
      {selectedBlock && (
        <BlockDetailPanel
          block={selectedBlock}
          mempoolBlocks={mempoolBlocks}
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

      {/* 연결 실패 에러 오버레이 (자동 재연결) */}
      {showErrorOverlay && (
        <ErrorOverlay
          onSettings={() => { setShowErrorOverlay(false); setSettingsOpen(true); }}
          onFallback={() => handleConnect('mempool', '')}
          onRetry={() => {
            setShowErrorOverlay(false);
            setSourceType(prev => {
              setTimeout(() => setSourceType(prev), 50);
              return null;
            });
          }}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          sourceType={sourceType}
          serverUrl={serverUrl}
          onConnect={handleConnect}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* 스크린 리더용 동적 알림 */}
      <div aria-live="polite" aria-atomic="true" className="sr-only"
           style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {ariaAnnouncement}
      </div>

      {/* 온보딩 가이드 투어 */}
      <OnboardingTour />
    </div>
  );
}
