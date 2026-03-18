'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const config = require('./config');
const rpc = require('./rpc');
const broadcaster = require('./broadcaster');
const { startZmq, getMode } = require('./zmq');

const app = express();

// ── 정적 파일 서빙 (프로덕션: Vite 빌드 결과물) ─────────────────────────────
const CLIENT_DIST = path.join(__dirname, '../client/dist');
app.use(express.static(CLIENT_DIST));

// ── REST API ─────────────────────────────────────────────────────────────────

/** 헬스 체크 */
app.get('/health', (req, res) => {
  res.json({ ok: true, mode: getMode(), clients: broadcaster.clientCount });
});

/** 노드 기본 정보 스냅샷 */
app.get('/api/info', async (req, res) => {
  try {
    const [chainInfo, networkInfo, peerInfo] = await Promise.all([
      rpc.getBlockchainInfo(),
      rpc.getNetworkInfo(),
      rpc.getPeerInfo(),
    ]);
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
    });
  } catch (err) {
    res.status(503).json({ error: err.message, mode: getMode() });
  }
});

/** mempool 스냅샷 */
app.get('/api/mempool', async (req, res) => {
  try {
    const ids = await rpc.getRawMempool();
    res.json({ count: ids.length, mode: getMode() });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// SPA 폴백 (React Router 지원)
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

// ── HTTP + WebSocket 서버 ────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// /ws 경로만 WebSocket 업그레이드 허용
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  broadcaster.addClient(ws);
  console.log(`[WS] 클라이언트 연결 (총 ${broadcaster.clientCount}명)`);

  // 연결 즉시 현재 상태 전송
  broadcaster.sendTo(ws, 'connected', { mode: getMode() });

  // 초기 노드 정보 전송 (실패해도 무시)
  rpc.getBlockchainInfo()
    .then((info) => {
      broadcaster.sendTo(ws, 'init', {
        chain: info.chain,
        blocks: info.blocks,
        bestBlockHash: info.bestblockhash,
        mode: getMode(),
      });
    })
    .catch(() => {
      broadcaster.sendTo(ws, 'init', { mode: getMode() });
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
