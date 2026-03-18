# Bitcoin Node Visualizer

Real-time Bitcoin network visualization — watch blocks being received, validated, and propagated across peers through a live Canvas animation.

**Public website**: https://fullnode-visualizer.vercel.app — open in any browser, no setup required.

---

## Modes

### Default: mempool.space (Public)
Connects directly to `wss://mempool.space/api/v1/ws` from your browser. No backend server needed. Shows live mainnet blocks, transactions, mempool stats, fee rates, and difficulty adjustment.

### Custom Node: Electrum WSS
Connect to your own full node via a Fulcrum Electrum server (WSS). Block events come from your node; mempool/fee data is supplemented from mempool.space REST.

---

## Features

- **Real-time TX visualization**: Every mempool transaction appears as an orange particle flying from peers to the center node. Frame-batched so 50+ tx/s doesn't drop frames.
- **3-stage block animation**: Block arrival (peer → node) → validation pulse (+500ms) → propagation to all peers (+1s)
- **HUD panels**: Fee rate, mempool count, difficulty adjustment progress, TX/s, recent blocks with pool name and fee range
- **Custom node support**: Switch to your Fulcrum WSS endpoint via the settings panel (⚙ Node Settings button)
- **Particle system**: Up to 500 simultaneous particles — TX bubbles (orange), block packets (green squares)
- **Umbrel-native**: Docker multi-stage build also available for self-hosting

---

## Custom Node (Electrum WSS) Setup

### Requirements
- A Bitcoin full node with [Fulcrum](https://github.com/cculianu/Fulcrum) installed and running
- Fulcrum WSS port accessible from your browser (default: `50004`)

### Fulcrum configuration (`fulcrum.conf`)
```ini
# Enable SSL/WSS
ssl = 0.0.0.0:50004
cert = /path/to/fullchain.pem
key  = /path/to/privkey.pem
```

### Connecting
1. Open https://fullnode-visualizer.vercel.app
2. Click **⚙ Node Settings** (bottom right)
3. Select **Custom Node (Electrum WSS)**
4. Enter your WSS URL: `wss://your-node-ip:50004`
5. Click **Connect**

> **Note**: Your browser must be able to reach the WSS endpoint. For home nodes, this typically requires port forwarding and a valid TLS certificate (self-signed certs will be rejected by browsers).

---

## Umbrel Self-Hosting

### Sideload Installation

```bash
# 1. Clone onto your Umbrel home server
git clone https://github.com/AsadoConKimchi/bitcoin-node-visualizer.git
cd bitcoin-node-visualizer

# 2. Build the Docker image
docker build -t bitcoin-node-visualizer:latest ./app

# 3. Find your Umbrel Bitcoin network name
export BITCOIN_NETWORK_NAME=bitcoin_default

# 4. Start
docker compose up -d

# 5. Open http://<umbrel-ip>:3000
```

### ZMQ Configuration (for real-time mode)

Add to your `bitcoin.conf`:
```ini
zmqpubrawblock=tcp://0.0.0.0:28332
zmqpubrawtx=tcp://0.0.0.0:28333
```

On Umbrel, edit via:
`umbrel/app-data/bitcoin/data/bitcoin/bitcoin.conf`

Then restart Bitcoin Core. Without ZMQ, the server falls back to RPC polling.

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

Check yours with: `docker network ls | grep -i bitcoin`

---

## Local Development

```bash
cd app
npm install

# Frontend dev server only (connects to mempool.space directly)
npm run dev
# → http://localhost:5173
```

**Build:**
```bash
npm run build
# Output: app/client/dist/
```

---

## Architecture

```
                    ┌──────────────┐
                    │   App.jsx    │
                    │ (상태 관리)   │
                    └──────┬───────┘
                           │ subscribe(type, cb)
                    ┌──────▼───────┐
                    │  DataSource  │  (어댑터 패턴)
                    │  connect()   │
                    │  subscribe() │
                    │  destroy()   │
                    └───┬──────┬───┘
                        │      │
          ┌─────────────▼─┐  ┌─▼──────────────────┐
          │MempoolAdapter │  │  ElectrumAdapter    │
          │(기본, 공개)    │  │  (커스텀 노드)       │
          │WS+REST 직접   │  │  Fulcrum WSS 직접   │
          └───────────────┘  └─────────────────────┘
```

```
client/src/
  datasource/
    EventBus.js        — 이벤트 버스 클래스
    MempoolAdapter.js  — mempool.space WS + REST
    ElectrumAdapter.js — Fulcrum WSS + REST 하이브리드
    index.js           — createDataSource() 팩토리
  components/
    SettingsPanel.jsx  — 데이터 소스 설정 UI
  canvas/
    layout.js          — 위치, 색상 팔레트
    particles.js       — TX 버블 / 블록 패킷 물리
    renderer.js        — Canvas 드로우 함수
    Universe.jsx       — Canvas 컴포넌트 + 애니메이션 루프
  App.jsx              — 상태 관리, 이벤트 → state
```

## Connection Status (HUD)

| Color | Meaning |
|---|---|
| 🟢 Green | Connected (mempool.space or Electrum) |
| 🟠 Orange | Connecting... |
| 🔴 Red | Disconnected |
