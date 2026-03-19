# Bitcoin Node Visualizer

Real-time Bitcoin network visualization — watch blocks being received, validated, and propagated across peers on an interactive 3D globe.

**Public website**: https://fullnode-visualizer.vercel.app — open in any browser, no setup required.

---

## Modes

### Default: mempool.space (Public)
Connects to `wss://mempool.space/api/v1/ws` from your browser. No backend needed. Shows live mainnet blocks, transactions, mempool stats, fee rates, and difficulty adjustment.

### Self-hosted: Bitcoin Core (Full Node)
Run the included Node.js server alongside Bitcoin Core. The client auto-detects the server on page load (`/health` check) — no popup, no manual configuration. Shows full-node-exclusive data unavailable from mempool.space.

---

## Features

- **3D globe**: Real nodes rendered as points (bitnodes.io + actual Bitcoin peers). Arcs animate block propagation and peer-to-peer traffic.
- **3-stage block animation**: Arrival (peer → node) → validation → propagation to peers
- **HUD panel**: Fee rate, mempool count + usage (MB/max), min relay fee, difficulty adjustment, TX/s, connection status
- **Block verification overlay**: Merkle root verification visualization
- **TX verification overlay**: Signature/script verification display
- **Chain strip**: Recent blocks with pool name, height, and TX count
- **Mempool panel**: Mempool block visualization
- **Self-hosted extras** (server mode only):
  - Mempool policy: TX count + usage/max MB + min relay fee (`getmempoolinfo`)
  - Chain tips panel: Stale/fork/orphan block history (`getchaintips`)
  - Node-estimated fee rates (`estimatesmartfee`)
- **Auto-detection**: On load, client probes `/health`. Success → same-origin server mode (no popup). Failure → mempool.space fallback.

---

## Self-Hosted Setup (Umbrel / Docker)

### Requirements
- Bitcoin Core (or Bitcoin Knots) with RPC enabled
- Optional: ZMQ for real-time block/tx events (falls back to RPC polling)

### Quick Start

```bash
# Clone
git clone https://github.com/AsadoConKimchi/bitcoin-node-visualizer.git
cd bitcoin-node-visualizer

# Build Docker image
docker build -t bitcoin-node-visualizer:latest ./app

# Set your Bitcoin network name
export BITCOIN_NETWORK_NAME=bitcoin_default

# Start
docker compose up -d

# Open http://<host-ip>:3000
# The app auto-detects the server — no settings popup needed
```

### ZMQ Configuration (recommended for real-time mode)

Add to `bitcoin.conf`:
```ini
zmqpubrawblock=tcp://0.0.0.0:28332
zmqpubrawtx=tcp://0.0.0.0:28333
```

On Umbrel: `umbrel/app-data/bitcoin/data/bitcoin/bitcoin.conf`

Restart Bitcoin Core after editing. Without ZMQ, the server falls back to RPC polling automatically.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BITCOIN_RPC_HOST` | `bitcoin` | Bitcoin Core hostname/IP |
| `BITCOIN_RPC_PORT` | `8332` | RPC port |
| `BITCOIN_RPC_USER` | `umbrel` | RPC username |
| `BITCOIN_RPC_PASS` | `umbrel` | RPC password |
| `BITCOIN_ZMQ_HOST` | `bitcoin` | ZMQ hostname/IP |
| `BITCOIN_ZMQ_RAWBLOCK_PORT` | `28332` | rawblock ZMQ port |
| `BITCOIN_ZMQ_RAWTX_PORT` | `28333` | rawtx ZMQ port |
| `PORT` | `3000` | App HTTP port |
| `BITCOIN_NETWORK_NAME` | `bitcoin_default` | Docker network name |

### Docker Network Names

| Umbrel Version | Network Name |
|---|---|
| Umbrel OS (latest) | `bitcoin_default` |
| Umbrel 0.5.x | `umbrel_main_network` |

Check yours: `docker network ls | grep -i bitcoin`

### Remote Access (Tailscale)

If accessing the self-hosted server from outside the local network, configure a Tailscale IP in Settings → My Full Node → `http://100.x.x.x:3000`.

---

## Local Development

```bash
cd app
npm install

# Frontend only (connects to mempool.space directly)
npm run dev
# → http://localhost:5173

# Frontend + backend (full node mode)
node server/index.js &
npm run dev
```

**Build:**
```bash
npm run build
# Output: app/client/dist/
```

---

## Architecture

```
Browser (React + Three.js globe)
  │
  ├─ Auto-detect: fetch /health (2s timeout)
  │    ├─ OK  → ServerAdapter (same-origin, no popup)
  │    └─ Fail → MempoolAdapter (mempool.space WS+REST)
  │
  └─ Manual override via ⚙ Node Settings

ServerAdapter
  ├─ WebSocket /ws  — init, tx, block:received/validated/propagated, mempool
  └─ REST polling (30s)
       ├─ /api/info          → chain, height, peers
       ├─ /api/mempool       → TX count
       ├─ /api/peers         → peer geolocations (GeoIP)
       ├─ /api/mempool/info  → policy: min fee, max size, usage (getmempoolinfo)
       ├─ /api/chaintips     → fork history (getchaintips)
       └─ /api/fees          → fee estimates 1/3/6 blocks (estimatesmartfee)

MempoolAdapter
  ├─ WebSocket wss://mempool.space/api/v1/ws
  └─ REST https://mempool.space/api/v1/...

Node.js Server (app/server/)
  ├─ Bitcoin Core RPC (rpc.js)
  ├─ ZMQ listener → broadcaster.js → WebSocket clients
  ├─ Fallback: RPC polling when ZMQ unavailable
  └─ GeoIP peer location (geoip-lite)
```

```
client/src/
  datasource/
    EventBus.js        — pub/sub base class
    MempoolAdapter.js  — mempool.space WS + REST
    ServerAdapter.js   — self-hosted server WS + REST (same-origin support)
    index.js           — createDataSource() factory
  components/
    HudPanels.jsx      — top-left info panel (adapts to source type)
    ChainTipsPanel.jsx — fork/stale block history (server mode only)
    SettingsPanel.jsx  — data source settings
    ToggleBar.jsx      — panel visibility toggles
    MempoolPanel.jsx   — mempool block visualization
    ChainStrip.jsx     — recent blocks strip
    BlockDetailPanel.jsx
    BlockVerifyPanel.jsx
    TxVerifyPanel.jsx
    VerificationOverlay.jsx
  globe/
    GlobeScene.jsx     — Three.js globe (react-globe.gl)
    nodeData.js        — node point data manager
  verification/
    BlockVerificationState.js
    TxVerificationState.js
  App.jsx              — state management, auto-detection, event routing
```

---

## Connection Status (HUD)

| Indicator | Meaning |
|---|---|
| `● LIVE` (green) | Connected |
| `◌ CONNECTING` (orange) | Connecting / reconnecting |
| `○ DISCONNECTED` (red) | Connection lost |

### Data Source Label (bottom of HUD)

| Label | Meaning |
|---|---|
| `mempool.space` | Public API mode |
| `self-hosted node` | Connected to your Bitcoin Core |
