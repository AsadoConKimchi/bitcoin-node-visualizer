import React, { useState, useCallback, useEffect, useRef } from 'react';
import GlobeScene from './globe/GlobeScene.jsx';
import { NodeDataManager, MY_NODE } from './globe/nodeData.js';
import { createDataSource } from './datasource/index.js';
import { BlockVerificationState } from './verification/BlockVerificationState.js';
import { TxVerificationState } from './verification/TxVerificationState.js';
import ToggleBar from './components/ToggleBar.jsx';
import SearchBar from './components/SearchBar.jsx';
import HudPanels from './components/HudPanels.jsx';
import MainPanel from './components/MainPanel.jsx';
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
// TX 링 생성 최소 간격 (ms)
const RING_THROTTLE_MS = 300;
// 실제 txid 버퍼 최대 크기
const TX_BUFFER_MAX = 60;
// TX 스트림 최대 표시 수
const TX_STREAM_MAX = 20;
// TX 아크 쓰로틀 (ms)
const TX_ARC_THROTTLE_MS = 500;
// TX 검증 실패 확률 (교육용)
const TX_FAIL_CHANCE = 0.03;

const LS_SOURCE_TYPE = 'bnv_sourceType';
const LS_SERVER_URL = 'bnv_serverUrl';

const REST_BASE = 'https://mempool.space/api';

let _arcId = 0;
let _ringId = 0;

// 랜덤 노드 N개 선택
function pickRandom(arr, n) {
  if (!arr?.length) return [];
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(arr[Math.floor(Math.random() * arr.length)]);
  }
  return result.filter(Boolean);
}

export default function App() {
  // ── 데이터 소스 설정 ──────────────────────────────────────────────
  const [sourceType, setSourceType] = useState(null);
  const [serverUrl, setServerUrl] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);
  const errorTimerRef = useRef(null);

  // ── BitfeedFloor ref ──────────────────────────────────────────────
  const bitfeedRef = useRef(null);

  // ── 마운트 시 자동 감지 (최대 3회 재시도) ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    async function tryHealth(attempt) {
      if (cancelled) return;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/health', { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error('not ok');
        const json = await res.json();
        if (!json?.ok) throw new Error('not ok');
        if (!cancelled) {
          setSourceType('server');
          setServerUrl('');
        }
      } catch {
        if (cancelled) return;
        if (attempt < 3) {
          retryTimer = setTimeout(() => tryHealth(attempt + 1), 1000);
        } else {
          const saved = localStorage.getItem(LS_SOURCE_TYPE) || 'mempool';
          const savedUrl = localStorage.getItem(LS_SERVER_URL) || '';
          setSourceType(saved === 'mynode' ? 'mempool' : saved);
          setServerUrl(savedUrl);
        }
      }
    }

    tryHealth(1);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // ── 토글 패널 가시성 ──────────────────────────────────────────────
  const [visible, setVisible] = useState({
    p2p: true,
    txVerify: false,
    mempool: false,
    blockVerify: false,
    internals: false,
  });

  // ── 네트워크 상태 ─────────────────────────────────────────────────
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
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [mempoolBlocks, setMempoolBlocks] = useState([]);
  const [mempoolInfo, setMempoolInfo] = useState(null);
  const [chaintips, setChaintips] = useState([]);
  const [utxoStats, setUtxoStats] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [securityInfo, setSecurityInfo] = useState(null);

  const recentBlocksRef = useRef([]);
  recentBlocksRef.current = recentBlocks;

  // ── CompactBlock 수동 트리거 ──────────────────────────────────────
  const [forceCompactBlock, setForceCompactBlock] = useState(null);

  const handleReplayCompactBlock = useCallback(() => {
    const blocks = recentBlocksRef.current;
    if (blocks.length > 0) {
      setForceCompactBlock({ block: blocks[0], ts: Date.now() });
    }
  }, []);

  // ── 지구본 데이터 ─────────────────────────────────────────────────
  const [nodePoints, setNodePoints] = useState([MY_NODE]);
  const [arcs, setArcs] = useState([]);
  const [rings, setRings] = useState([]);
  const nodePointsRef = useRef([MY_NODE]);
  const lastRingTimeRef = useRef(0);
  const lastTxArcTimeRef = useRef(0);

  useEffect(() => {
    const mgr = new NodeDataManager((points) => {
      nodePointsRef.current = points;
      setNodePoints(points);
    }, serverUrl);
    mgr.start();
    return () => mgr.destroy();
  }, [serverUrl]);

  const addArcs = useCallback((newArcs) => {
    if (!newArcs.length) return;
    const tagged = newArcs.map((a) => ({ ...a, _id: ++_arcId }));
    setArcs((prev) => [...prev, ...tagged]);
    setTimeout(() => {
      const ids = new Set(tagged.map((a) => a._id));
      setArcs((prev) => prev.filter((a) => !ids.has(a._id)));
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

  // ── 블록 검증 상태 ──────────────────────────────────────────────
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

  // ── TX 스트림 상태 ──────────────────────────────────────────────
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

        // 검증 실패 시 → BitfeedFloor에 반려 TX 추가
        if (state.failed) {
          setTimeout(() => {
            bitfeedRef.current?.addRejected(txData);
            // 2초 후 스트림에서 제거
            setTimeout(() => {
              setTxStream((current) => current.filter((t) => t.txid !== txid));
              txStreamVerifyRefs.current.get(txid)?.destroy();
              txStreamVerifyRefs.current.delete(txid);
            }, 2000);
          }, 500);
        }

        // 검증 완료 시 → BitfeedFloor에 통과 TX 추가
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
      }, { failChance: TX_FAIL_CHANCE });

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

  // ── TX/블록/주소 상세 패널 ──────────────────────────────────────
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);

  // 블록검증 토글 → 즉시 최신 블록으로 검증 시작 + 상호배타 로직
  const handleToggle = useCallback((key) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };

      if (key === 'blockVerify' && next.blockVerify) {
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

  // ── 검색 핸들러 ───────────────────────────────────────────────────
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

  // ── 데이터 소스 구독 ──────────────────────────────────────────────
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
      if (data.recentBlocks?.length) {
        setRecentBlocks(data.recentBlocks.slice(0, MAX_RECENT_BLOCKS));
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
          addArcs([{
            startLat: src.lat,
            startLng: src.lng,
            endLat: MY_NODE.lat,
            endLng: MY_NODE.lng,
            color: '#60a5fa44',
          }]);
        }
      }

      if (data.txid) {
        addToTxStream(data);
      }
    }));

    unsubs.push(ds.subscribe('txPerSec', ({ value }) => setTxPerSec(value)));

    unsubs.push(ds.subscribe('block:received', (data) => {
      if (data.height != null) setBlockHeight(data.height);

      const peers = nodePointsRef.current.filter((n) => n.isMyPeer);
      addArcs(
        pickRandom(peers.length ? peers : nodePointsRef.current.filter((n) => !n.isMyNode), 4).map((n) => ({
          startLat: n.lat,
          startLng: n.lng,
          endLat: MY_NODE.lat,
          endLng: MY_NODE.lng,
          color: '#f7931a',
        }))
      );

      startBlockVerification(data);
      setVisible((prev) => ({ ...prev, blockVerify: true }));
    }));

    unsubs.push(ds.subscribe('block:validated', (data) => {
      setRecentBlocks((prev) => [data, ...prev].slice(0, MAX_RECENT_BLOCKS));
    }));

    unsubs.push(ds.subscribe('block:propagated', () => {
      const peers = nodePointsRef.current.filter((n) => n.isMyPeer);
      addArcs(
        pickRandom(peers.length ? peers : nodePointsRef.current.filter((n) => !n.isMyNode), 10).map((n) => ({
          startLat: MY_NODE.lat,
          startLng: MY_NODE.lng,
          endLat: n.lat,
          endLng: n.lng,
          color: '#22c55e',
        }))
      );
    }));

    unsubs.push(ds.subscribe('block:mined', ({ count, txids }) => {
      console.log(`[App] ${count} txs confirmed`);
      // BitfeedFloor sweep 애니메이션
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

  // ── 설정 저장 ─────────────────────────────────────────────────────
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

  // MainPanel 표시 여부 (어떤 섹션이라도 켜져 있으면)
  const mainPanelVisible = visible.txVerify || visible.mempool || visible.blockVerify;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 3D 지구본 — 전체 배경 */}
      <GlobeScene nodePoints={nodePoints} arcs={arcs} rings={rings} />

      {/* 상단 토글 바 */}
      <ToggleBar visible={visible} onToggle={handleToggle} />

      {/* 검색 바 */}
      <div className="absolute top-3 right-4 z-10 max-sm:right-2">
        <SearchBar
          onSearchBlock={handleSearchBlock}
          onSearchTx={handleSearchTx}
          onSearchAddress={handleSearchAddress}
        />
      </div>

      {/* 좌상단 HUD */}
      <HudPanels
        visible={visible.p2p}
        compact={false}
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
      />

      {/* 체인 분기 패널 (서버 모드에서만) */}
      {sourceType === 'server' && chaintips.length > 0 && (
        <ChainTipsPanel chaintips={chaintips} />
      )}

      {/* 메인 패널 (TX검증 + 블록검증 + Bitfeed 멤풀 바닥) — 화면 75% */}
      <MainPanel
        txStream={txStream}
        blockVerifyState={blockVerifyState}
        mempoolCount={mempoolCount}
        showTx={visible.txVerify}
        showMempool={visible.mempool}
        showBlock={visible.blockVerify}
        onTxClick={handleTxClick}
        bitfeedRef={bitfeedRef}
      />

      {/* 예상 블록 적층 시각화 (멤풀 토글 ON + 블록검증 OFF + MainPanel 안 보일 때) */}
      <MempoolBlocksPanel
        mempoolBlocks={mempoolBlocks}
        visible={visible.mempool && !visible.blockVerify && !mainPanelVisible}
      />

      {/* 하단 체인 스트립 */}
      <ChainStrip
        recentBlocks={recentBlocks}
        onBlockClick={handleBlockClick}
        onReplayCompactBlock={handleReplayCompactBlock}
      />

      {/* 블록 상세 패널 */}
      {selectedBlock && (
        <BlockDetailPanel
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onTxClick={handleTxClick}
        />
      )}

      {/* TX 상세 패널 */}
      {selectedTx && (
        <TxDetailPanel
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
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

      {/* 설정 버튼 */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute bottom-5 left-5 bg-black/75 border border-btc-orange
                  rounded-md text-btc-orange font-mono text-sm px-3.5 py-2
                  cursor-pointer z-15 hover:bg-btc-orange/10 transition-colors
                  max-sm:bottom-3 max-sm:left-3 max-sm:text-xs max-sm:px-2.5 max-sm:py-1.5"
      >
        ⚙ Settings
      </button>

      {/* 연결 실패 에러 오버레이 */}
      {showErrorOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="bg-black/95 border border-error rounded-md px-8 py-7
                        font-mono text-btc-orange text-center max-w-[320px]">
            <div className="text-base font-bold mb-2.5">연결 실패</div>
            <div className="text-sm text-[#a16207] mb-5">
              서버에 연결할 수 없습니다. 설정을 확인하세요.
            </div>
            <div className="flex gap-2.5 justify-center">
              <button
                className="bg-btc-orange border-none rounded text-black font-mono font-bold
                          text-sm px-4 py-2 cursor-pointer hover:bg-btc-orange/90"
                onClick={() => { setShowErrorOverlay(false); setSettingsOpen(true); }}
              >
                설정 변경
              </button>
              <button
                className="bg-transparent border border-[#a16207] rounded text-[#a16207]
                          font-mono text-sm px-4 py-2 cursor-pointer hover:border-btc-orange"
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
