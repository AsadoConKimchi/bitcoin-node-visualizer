'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const geoip = require('geoip-lite');

const rateLimit = require('express-rate-limit');

const config = require('./config');
const rpc = require('./rpc');
const broadcaster = require('./broadcaster');
const { startZmq, getMode } = require('./zmq');

const app = express();

// 외부 IP 기반 노드 위치 캐시 (서버 시작 시 1회 조회)
let _externalIpLocation = null;
(async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const { ip } = await res.json();
      const geo = geoip.lookup(ip);
      if (geo?.ll) {
        _externalIpLocation = { lat: geo.ll[0], lng: geo.ll[1] };
        console.log(`[server] 외부 IP GeoIP 성공: ${ip} → [${geo.ll[0]}, ${geo.ll[1]}]`);
      }
    }
  } catch (_) {
    console.warn('[server] 외부 IP 감지 실패 — 노드 위치 기본값 사용');
  }
})();

// CORS — Tailscale 내부망이므로 전체 허용
app.use(cors());

// 보안 헤더
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// REST API 요청 제한 (60req/min)
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── 정적 파일 서빙 (프로덕션: Vite 빌드 결과물) ─────────────────────────────
const CLIENT_DIST = path.join(__dirname, '../client/dist');
app.use(express.static(CLIENT_DIST));

// ── REST API ─────────────────────────────────────────────────────────────────

/** 헬스 체크 — 실제 RPC 호출로 연결 상태 확인 */
app.get('/health', async (req, res) => {
  const mode = getMode();
  let rpcOk = false;
  try {
    await rpc.getBlockCount();
    rpcOk = true;
  } catch (_) { /* RPC 연결 실패 */ }
  res.json({
    ok: true,
    mode,
    rpcConnected: rpcOk,
    clients: broadcaster.clientCount,
  });
});

/** 노드 기본 정보 스냅샷 (확장: 피어 유형, 보안, 시간 오프셋, DA 예상 조정) */
app.get('/api/info', async (req, res) => {
  try {
    const [chainInfo, networkInfo, peerInfo] = await Promise.all([
      rpc.getBlockchainInfo(),
      rpc.getNetworkInfo(),
      rpc.getPeerInfo(),
    ]);

    // 노드 위치: localaddresses(clearnet만) → GeoIP, 없으면 외부 IP 캐시
    let nodeLocation = null;
    const localAddrs = networkInfo.localaddresses || [];
    for (const la of localAddrs) {
      // .onion/.i2p 주소는 GeoIP 불가 — 건너뛰기
      if (la.address.endsWith('.onion') || la.address.endsWith('.i2p')) continue;
      const geo = geoip.lookup(la.address);
      if (geo?.ll) {
        nodeLocation = { lat: geo.ll[0], lng: geo.ll[1] };
        break;
      }
    }
    // fallback: 외부 IP 감지 캐시
    if (!nodeLocation && _externalIpLocation) {
      nodeLocation = _externalIpLocation;
    }
    // DA 진행률 계산
    const daBlocks = chainInfo.blocks % 2016;
    const difficultyAdjustment = {
      progressPercent: (daBlocks / 2016) * 100,
      remainingBlocks: 2016 - daBlocks,
    };

    // DA 예상 조정 폭 계산
    try {
      if (daBlocks > 0) {
        const epochStartHeight = chainInfo.blocks - daBlocks;
        const epochStartHash = await rpc.getBlockHash(epochStartHeight);
        const [epochStartBlock, currentBlock] = await Promise.all([
          rpc.getBlock(epochStartHash, 1),
          rpc.getBlock(chainInfo.bestblockhash, 1),
        ]);
        const actualTimespan = currentBlock.time - epochStartBlock.time;
        const expectedTimespan = daBlocks * 600; // 남은 블록만큼의 예상 시간
        const estimatedChange = ((actualTimespan / expectedTimespan) - 1) * 100;
        difficultyAdjustment.estimatedChange = Math.round(estimatedChange * 10) / 10;
      }
    } catch (_) {
      // DA 추정 실패 시 무시
    }

    // 피어 연결 유형 집계
    const peerTypes = { fullRelay: 0, blockRelayOnly: 0, feeler: 0, addrFetch: 0 };
    let inbound = 0, outbound = 0, v2Transport = 0;
    const timeOffsets = [];
    for (const p of peerInfo) {
      if (p.inbound) inbound++; else outbound++;
      if (p.connection_type === 'block-relay-only') peerTypes.blockRelayOnly++;
      else if (p.connection_type === 'feeler') peerTypes.feeler++;
      else if (p.connection_type === 'addr-fetch') peerTypes.addrFetch++;
      else peerTypes.fullRelay++;
      if (p.transport_protocol_type === 'v2' || p.version >= 70016) v2Transport++;
      if (p.timeoffset != null) timeOffsets.push(p.timeoffset);
    }

    // 시간 오프셋 중앙값
    timeOffsets.sort((a, b) => a - b);
    const medianTimeOffset = timeOffsets.length > 0
      ? timeOffsets[Math.floor(timeOffsets.length / 2)]
      : 0;

    // 네트워크 보안 정보
    const networks = {};
    if (networkInfo.networks) {
      for (const n of networkInfo.networks) {
        networks[n.name] = n.reachable;
      }
    }

    // Tor/I2P 피어 수
    let torPeers = 0, i2pPeers = 0;
    for (const p of peerInfo) {
      const addr = p.addr || '';
      if (addr.includes('.onion')) torPeers++;
      else if (addr.includes('.b32.i2p')) i2pPeers++;
    }

    res.json({
      chain: chainInfo.chain,
      blocks: chainInfo.blocks,
      headers: chainInfo.headers,
      bestBlockHash: chainInfo.bestblockhash,
      difficulty: chainInfo.difficulty,
      verificationProgress: chainInfo.verificationprogress,
      connections: networkInfo.connections,
      version: networkInfo.version,
      subversion: networkInfo.subversion,
      peerCount: peerInfo.length,
      mode: getMode(),
      difficultyAdjustment,
      // Phase 1 확장
      peerTypes,
      inbound,
      outbound,
      v2Transport,
      medianTimeOffset,
      localServices: networkInfo.localservicesnames || [],
      networks,
      torPeers,
      i2pPeers,
      // 노드 위치
      nodeLocation,
      // pruning
      pruned: chainInfo.pruned || false,
      pruneHeight: chainInfo.pruneheight || null,
      sizeOnDisk: chainInfo.size_on_disk || null,
    });
  } catch (err) {
    console.error('[api/info]', err.message);
    res.status(503).json({ error: 'Service unavailable', mode: getMode() });
  }
});

/** mempool 스냅샷 */
app.get('/api/mempool', async (req, res) => {
  try {
    const ids = await rpc.getRawMempool();
    res.json({ count: ids.length, mode: getMode() });
  } catch (err) {
    console.error(`[api]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** 실제 피어 위치 (getpeerinfo + GeoIP) */
app.get('/api/peers', async (req, res) => {
  try {
    const peers = await rpc.getPeerInfo();
    const points = peers
      .map((p) => {
        const ip = p.addr.split(':')[0].replace(/^\[/, '').replace(/\]$/, ''); // IPv6 대괄호 제거
        const geo = geoip.lookup(ip);
        return {
          ip,
          lat: geo?.ll?.[0] ?? null,
          lng: geo?.ll?.[1] ?? null,
          subver: p.subver,
          inbound: p.inbound,
          country: geo?.country ?? null,
          pingtime: p.pingtime ?? null,
        };
      })
      .filter((p) => p.lat != null);
    res.json({ peers: points, count: peers.length, geoResolved: points.length, total: peers.length });
  } catch (err) {
    console.error(`[api]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** 멤풀 정책/상태 스냅샷 (풀노드 고유) */
app.get('/api/mempool/info', async (req, res) => {
  try {
    const info = await rpc.getMempoolInfo();
    res.json(info);
  } catch (err) {
    console.error(`[api]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** 체인 분기 기록 (풀노드 고유) */
app.get('/api/chaintips', async (req, res) => {
  try {
    const tips = await rpc.getChainTips();
    res.json(tips);
  } catch (err) {
    console.error(`[api]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** UTXO 세트 통계 (풀노드 고유 — 느린 RPC, 5분 캐시) */
let _utxoCache = null;
let _utxoCacheTime = 0;
const UTXO_CACHE_MS = 5 * 60 * 1000;

app.get('/api/utxo-stats', async (req, res) => {
  try {
    const now = Date.now();
    if (_utxoCache && (now - _utxoCacheTime) < UTXO_CACHE_MS) {
      return res.json(_utxoCache);
    }
    const info = await rpc.getTxOutSetInfo();
    _utxoCache = {
      txouts: info.txouts,
      diskSize: info.disk_size,
      hashSerialized: info.hash_serialized_2,
      totalAmount: info.total_amount,
      bestBlock: info.bestblock,
      height: info.height,
    };
    _utxoCacheTime = now;
    res.json(_utxoCache);
  } catch (err) {
    console.error(`[api]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** 스토리지 정보 (풀노드 고유) */
app.get('/api/storage', async (req, res) => {
  try {
    const chainInfo = await rpc.getBlockchainInfo();
    res.json({
      sizeOnDisk: chainInfo.size_on_disk,
      pruned: chainInfo.pruned || false,
      pruneHeight: chainInfo.pruneheight || null,
      blocks: chainInfo.blocks,
      headers: chainInfo.headers,
    });
  } catch (err) {
    console.error(`[api]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** 보안 정보 (풀노드 고유) */
app.get('/api/security', async (req, res) => {
  try {
    const [networkInfo, peerInfo] = await Promise.all([
      rpc.getNetworkInfo(),
      rpc.getPeerInfo(),
    ]);

    // 네트워크별 상태
    const networks = {};
    if (networkInfo.networks) {
      for (const n of networkInfo.networks) {
        networks[n.name] = { reachable: n.reachable, proxy: n.proxy || null };
      }
    }

    // BIP324 v2 Transport 피어 수
    let v2Count = 0;
    const asnSet = new Set();
    const asnCounts = {};
    let blockRelayOnly = 0;
    let torPeers = 0, i2pPeers = 0, cjdnsPeers = 0;
    for (const p of peerInfo) {
      if (p.transport_protocol_type === 'v2') v2Count++;
      if (p.mapped_as) {
        asnSet.add(p.mapped_as);
        asnCounts[p.mapped_as] = (asnCounts[p.mapped_as] || 0) + 1;
      }
      if (p.connection_type === 'block-relay-only') blockRelayOnly++;
      const addr = p.addr || '';
      if (addr.includes('.onion')) torPeers++;
      else if (addr.includes('.b32.i2p')) i2pPeers++;
      else if (p.network === 'cjdns') cjdnsPeers++;
    }

    // ASN 빈도 상위 10개
    const topASNs = Object.entries(asnCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([asn, count]) => ({ asn, count }));

    res.json({
      localServices: networkInfo.localservicesnames || [],
      v2Transport: v2Count,
      totalPeers: peerInfo.length,
      networks,
      uniqueASNs: asnSet.size,
      topASNs,
      blockRelayOnly,
      peersByNetwork: {
        clearnet: peerInfo.length - torPeers - i2pPeers - cjdnsPeers,
        tor: torPeers,
        i2p: i2pPeers,
        cjdns: cjdnsPeers,
      },
      warnings: networkInfo.warnings || '',
    });
  } catch (err) {
    console.error(`[api]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** IBD 상태 (풀노드 고유 — 10초 캐시) */
let _ibdCache = null;
let _ibdCacheTime = 0;
const IBD_CACHE_MS = 10_000;

app.get('/api/ibd-status', async (req, res) => {
  try {
    const now = Date.now();
    if (_ibdCache && (now - _ibdCacheTime) < IBD_CACHE_MS) {
      return res.json(_ibdCache);
    }
    const chainInfo = await rpc.getBlockchainInfo();
    _ibdCache = {
      isIBD: chainInfo.initialblockdownload || false,
      verificationProgress: chainInfo.verificationprogress,
      headers: chainInfo.headers,
      blocks: chainInfo.blocks,
      sizeOnDisk: chainInfo.size_on_disk,
      chain: chainInfo.chain,
    };
    _ibdCacheTime = now;
    res.json(_ibdCache);
  } catch (err) {
    console.error('[api/ibd-status]', err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** 수수료 추정 — 1/3/6 블록 목표 (풀노드 고유) */
app.get('/api/fees', async (req, res) => {
  try {
    const [fast, half, hour] = await Promise.all([
      rpc.estimateSmartFee(1),
      rpc.estimateSmartFee(3),
      rpc.estimateSmartFee(6),
    ]);
    // feerate는 BTC/kB 단위 → sat/vB 변환 (*1e8/1000)
    const toSat = (fr) => fr != null ? Math.round(fr * 1e5) : null;
    res.json({
      fastest: { blocks: 1, feerate: toSat(fast?.feerate) },
      half:    { blocks: 3, feerate: toSat(half?.feerate) },
      hour:    { blocks: 6, feerate: toSat(hour?.feerate) },
    });
  } catch (err) {
    console.error(`[api]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** TX 상세 (getrawtransaction verbose + prevout/fee 보강) */
app.get('/api/tx/:txid', async (req, res) => {
  try {
    const data = await rpc.getRawTransactionVerbose(req.params.txid);

    // prevout 누락 시 이전 TX에서 조회하여 보강
    const needsPrevout = data.vin?.some(v => !v.coinbase && !v.prevout);
    if (needsPrevout) {
      for (const vin of data.vin) {
        if (vin.coinbase || vin.prevout) continue;
        try {
          const prevTx = await rpc.getRawTransactionVerbose(vin.txid);
          const prevOut = prevTx?.vout?.[vin.vout];
          if (prevOut) {
            vin.prevout = {
              value: prevOut.value,
              scriptPubKey: prevOut.scriptPubKey,
            };
          }
        } catch { /* 이전 TX 조회 실패 시 건너뜀 */ }
      }
    }

    // fee 누락 시: prevout 합계 - vout 합계로 계산, 또는 mempool entry에서 조회
    if (data.fee == null) {
      // 방법 1: prevout에서 계산
      const hasAllPrevout = data.vin?.every(v => v.coinbase || v.prevout?.value != null);
      if (hasAllPrevout && !data.vin?.some(v => v.coinbase)) {
        const totalIn = data.vin.reduce((s, v) => s + (v.prevout?.value || 0), 0);
        const totalOut = data.vout?.reduce((s, v) => s + (v.value || 0), 0) || 0;
        data.fee = totalIn - totalOut;
      } else {
        // 방법 2: mempool entry에서 fee 조회
        try {
          const entry = await rpc.getMempoolEntry(req.params.txid);
          if (entry?.fees?.base != null) {
            data.fee = entry.fees.base;
          }
        } catch { /* mempool에 없으면 건너뜀 */ }
      }
    }

    res.json(data);
  } catch (err) {
    console.error(`[api/tx]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** 블록 상세 (getblock verbosity=1) */
app.get('/api/block/:hash', async (req, res) => {
  try {
    const data = await rpc.getBlock(req.params.hash, 1);
    res.json(data);
  } catch (err) {
    console.error(`[api/block]`, err.message);
    res.status(503).json({ error: 'Service unavailable' });
  }
});

/** Bulk 블록 조회 — Electrs 프록시 또는 RPC 폴백 */
const ELECTRS_URL = process.env.ELECTRS_URL || null;
const BULK_MAX = 10;

app.get('/api/blocks-bulk/:startHeight/:endHeight', async (req, res) => {
  const start = parseInt(req.params.startHeight);
  const end = parseInt(req.params.endHeight);
  if (isNaN(start) || isNaN(end) || end < start || end - start >= BULK_MAX) {
    return res.status(400).json({ error: `Range must be < ${BULK_MAX} blocks` });
  }

  try {
    if (ELECTRS_URL) {
      // Electrs Esplora HTTP API 프록시
      const resp = await fetch(`${ELECTRS_URL}/api/v1/blocks-bulk/${start}/${end}`);
      if (!resp.ok) throw new Error(`Electrs ${resp.status}`);
      const data = await resp.json();
      res.json(data);
    } else {
      // Bitcoin Core RPC 폴백 — 병렬 조회
      const heights = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      const blocks = await Promise.all(heights.map(h => rpc.getBlock(h, 1)));
      res.json(blocks.map(b => ({
        id: b.hash, height: b.height, timestamp: b.time,
        tx_count: b.nTx, previousblockhash: b.previousblockhash,
        extras: { pool: { name: null } },
      })));
    }
  } catch (err) {
    console.error('[api/blocks-bulk]', err.message);
    res.status(503).json({ error: err.message });
  }
});

// SPA 폴백 (React Router 지원)
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

// ── HTTP + WebSocket 서버 ────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

// WS_ALLOWED_ORIGINS: 쉼표 구분 허용 origin 목록 (미설정 시 모든 origin 허용)
const allowedOrigins = process.env.WS_ALLOWED_ORIGINS
  ? process.env.WS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

// /ws 경로만 WebSocket 업그레이드 허용
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  // origin 검증 (opt-in)
  if (allowedOrigins) {
    const origin = req.headers.origin || '';
    if (!allowedOrigins.includes(origin)) {
      socket.destroy();
      return;
    }
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  broadcaster.addClient(ws);
  console.log(`[WS] 클라이언트 연결 (총 ${broadcaster.clientCount}명)`);

  // 연결 즉시 현재 상태 전송
  broadcaster.sendTo(ws, 'connected', { mode: getMode() });

  // 초기 노드 정보 전송 (실패해도 무시)
  rpc.getBlockchainInfo()
    .then(async (info) => {
      let recentBlocks = [];
      try {
        let hash = info.bestblockhash;
        for (let i = 0; i < 5 && hash; i++) {
          // verbosity 1: txid 목록 포함, TX 본문 미포함 → Merkle tree 구성 가능
          const block = await rpc.getBlock(hash, 1);
          const txids = block.tx || [];
          recentBlocks.push({
            hash,
            height: block.height,
            txCount: block.nTx,
            version: block.version,
            time: block.time,
            nBits: block.bits,
            nonce: block.nonce,
            merkleRoot: block.merkleroot,
            txidSample: txids.length <= 8 ? txids : [...txids.slice(0, 4), ...txids.slice(-4)],
          });
          hash = block.previousblockhash;
        }
      } catch (_) {}

      broadcaster.sendTo(ws, 'init', {
        chain: info.chain,
        blocks: info.blocks,
        bestBlockHash: info.bestblockhash,
        mode: getMode(),
        rpcConnected: true,
        recentBlocks,
      });
    })
    .catch(() => {
      broadcaster.sendTo(ws, 'init', { mode: getMode(), rpcConnected: false });
    });
});

// ── 서버 시작 ─────────────────────────────────────────────────────────────────
server.listen(config.port, () => {
  console.log(`[server] Bitcoin Node Visualizer 시작 → http://localhost:${config.port}`);
  console.log(`[server] 환경: ${config.nodeEnv}`);

  // ZMQ 시작 (실패 시 RPC 폴링으로 자동 전환)
  startZmq().catch((err) => {
    console.error('[server] ZMQ 초기화 오류:', err.message);
  });
});

// 예상치 못한 오류로 앱이 죽지 않도록
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});
