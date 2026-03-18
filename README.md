# Bitcoin Node Visualizer

Real-time Bitcoin full node visualization — watch blocks being received, validated, and propagated across peers through a live Canvas animation.

## Features

- **ZMQ real-time mode**: Raw block & transaction events via ZMQ push sockets
- **RPC polling fallback**: Automatic 10s polling when ZMQ is unavailable
- **Canvas animation**: Particle system — TX bubbles fly from peers to node, block packets propagate outward
- **HUD panels**: Node info, connection status (ZMQ / RPC / none), recent blocks with Merkle validation indicator
- **Umbrel-native**: Docker multi-stage build, connects to `bitcoin_default` network

---

## Umbrel Sideload Installation

```bash
# 1. Clone onto your Umbrel home server
git clone https://github.com/AsadoConKimchi/bitcoin-node-visualizer.git
cd bitcoin-node-visualizer

# 2. Build the Docker image
docker build -t bitcoin-node-visualizer:latest ./app

# 3. Find your Umbrel Bitcoin network name
#    Umbrel OS:     bitcoin_default  (default)
#    Umbrel 0.5.x:  umbrel_main_network  (check with: docker network ls | grep bitcoin)
export BITCOIN_NETWORK_NAME=bitcoin_default

# 4. Start
docker compose up -d

# 5. Open http://<umbrel-ip>:3000
```

---

## ZMQ Configuration (Bitcoin Core)

Add the following to your `bitcoin.conf` to enable real-time ZMQ events:

```ini
zmqpubrawblock=tcp://0.0.0.0:28332
zmqpubrawtx=tcp://0.0.0.0:28333
```

**On Umbrel**, edit via:
`umbrel/app-data/bitcoin/data/bitcoin/bitcoin.conf`

Then restart Bitcoin Core. Without ZMQ, the app automatically falls back to RPC polling.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BITCOIN_RPC_HOST` | `bitcoin` | Bitcoin Core hostname/IP |
| `BITCOIN_RPC_PORT` | `8332` | RPC port |
| `BITCOIN_RPC_USER` | `umbrel` | RPC username |
| `BITCOIN_RPC_PASS` | `umbrel` | RPC password |
| `BITCOIN_ZMQ_HOST` | `bitcoin` | ZMQ hostname/IP |
| `BITCOIN_ZMQ_RAWBLOCK_PORT` | `28332` | rawblock ZMQ port |
| `BITCOIN_ZMQ_RAWTX_PORT` | `28333` | rawtx ZMQ port |
| `ZMQ_CONNECT_TIMEOUT_MS` | `5000` | ZMQ connect timeout before fallback |
| `RPC_POLL_INTERVAL_MS` | `10000` | RPC polling interval (ms) |
| `PORT` | `3000` | App HTTP port |
| `BITCOIN_NETWORK_NAME` | `bitcoin_default` | Docker network name |

---

## Local Development

**Prerequisites**: Node 20+, npm 9+

```bash
cd app
npm install

# Terminal 1 — backend (needs Bitcoin Core running locally or via SSH tunnel)
BITCOIN_RPC_HOST=127.0.0.1 node server/index.js

# Terminal 2 — frontend dev server with HMR
npm run dev
# → http://localhost:5173 (proxies /ws to localhost:3000)
```

**Build only:**
```bash
npm run build
# Output: app/client/dist/
```

**Docker build:**
```bash
docker build -t bnv ./app
docker run -p 3000:3000 \
  -e BITCOIN_RPC_HOST=<host> \
  -e BITCOIN_RPC_USER=<user> \
  -e BITCOIN_RPC_PASS=<pass> \
  bnv
```

---

## Architecture

```
Bitcoin Core
  │  ZMQ push (rawblock / rawtx)
  │  JSON-RPC (getblockcount, getblock, getrawmempool, …)
  ▼
Express + WebSocket Server (Node 20)
  server/
    config.js     — env vars → config object
    rpc.js        — JSON-RPC wrapper (native fetch)
    zmq.js        — ZMQ subscriber + RPC polling fallback
    validator.js  — Merkle verification, event emit
    broadcaster.js — EventEmitter + WS broadcast
    index.js      — HTTP + WS server, orchestration
  ▼
WebSocket (/ws)
  ▼
React + Canvas Client
  client/src/
    ws.js              — WS client, auto-reconnect, event bus
    canvas/layout.js   — positions, colors
    canvas/particles.js — TX bubble / block packet physics
    canvas/renderer.js  — Canvas draw functions
    canvas/Universe.jsx — Canvas component + animation loop
    App.jsx            — state management, WS → state
```

## Connection Status Indicator (HUD)

| Color | Meaning |
|---|---|
| 🟢 Green | ZMQ + RPC both working (full real-time) |
| 🟠 Orange | RPC polling only (no ZMQ) |
| 🔴 Red | No connection to Bitcoin Core |

---

## Implementation Notes

- **bitcoinjs-lib v5** (CommonJS) used for `Transaction.fromBuffer`, `Block.fromBuffer`, `crypto.hash256`
- **Merkle verification**: double-SHA256, little-endian byte order matching Bitcoin's wire format
- **ZMQ fallback**: 5s connection timeout → automatic switch to 10s RPC polling
- **RPC polling**: tracks block height changes; mempool count only (individual TX tracking requires ZMQ)
- **Docker**: Multi-stage build — Alpine + native build tools in stage 1, minimal runtime in stage 2
- **WebSocket path**: only `/ws` is upgraded; all other paths serve the React SPA

### Docker Network Names by Umbrel Version

| Umbrel Version | Network Name |
|---|---|
| Umbrel OS (latest) | `bitcoin_default` |
| Umbrel 0.5.x | `umbrel_main_network` |
| Custom | Set `BITCOIN_NETWORK_NAME` env var |

Check yours with: `docker network ls | grep -i bitcoin`
