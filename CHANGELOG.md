# Changelog

All notable changes to Bitcoin Node Visualizer are documented here.

---

## [Unreleased] — 2026-03-19

### Added — UX 대규모 개선 (Phase A~D)

#### Phase B: Globe Visual Improvements
- Background color: `#000005` → `#0a1628` (brighter dark navy)
- Lighting: AmbientLight `0x6688aa(2.0)`, DirectionalLight `0xccddff(1.2)` / `0x445577(0.5)`
- Atmosphere color: `#1e3a6e` → `#4a8bdf` (brighter blue halo)
- Node colors: my node=`#f7931a`(orange), peers=`#22c55e`(green), others=`#4a7dff`(blue)
- Node sizes: my node=1.0, peers=0.7, others=0.25
- Demo arcs removed — arcs only fire on real block/TX events
- TX arcs: peer→my node (blue, throttled 500ms)
- Rings now originate from my node position only

#### Phase A: Panel Overlap + Data Source Display
- Data source badge in HudPanels header: green `🔗 MY NODE (ZMQ)` or gray `📡 mempool.space`
- Removed old bottom-right source label text

#### Phase C: TX Flow Redesign
- **TxStreamPanel** (new): left-side scrollable TXID list (max 20), real-time 6-step verification per TX
  - Hover tooltip shows full verification progress (replaces TxVerifyPanel)
  - Verified TXs fade out and move to mempool pool
- **MempoolPoolPanel** (new): bottom-center pool of verified TXs as colored boxes
  - Box size based on TX weight (18–40px)
  - Box color based on fee rate: red≥30, orange≥15, green≥8, blue<8 sat/vB
  - Max 50 TX boxes, oldest removed from left
  - Hover shows TXID + fee, click opens TxDetailPanel
- ToggleBar: `Mempool` button removed, `TX 검증` renamed to `TX 흐름`
- VerificationOverlay now renders BlockVerifyPanel only (TX verification moved to TxStreamPanel)

#### Phase D: Block/TX Explorer
- **TxDetailPanel** (new): modal with TXID, size, weight, fee, inputs/outputs
  - Fetches details from `mempool.space/api/tx/{txid}`
  - Shows up to 5 inputs/outputs with addresses and BTC amounts
  - Link to mempool.space explorer
- **BlockDetailPanel** extended: collapsible TX list section
  - Fetches txids from `mempool.space/api/block/{hash}/txids`
  - Shows first 20 TXs, click any TX → opens TxDetailPanel
  - Coinbase TX labeled as "CB"

#### Files Added
- `components/TxStreamPanel.jsx` — left-side TX stream list with hover verification tooltip
- `components/MempoolPoolPanel.jsx` — bottom mempool pool visualization
- `components/TxDetailPanel.jsx` — TX detail modal

#### Files Modified
- `globe/GlobeScene.jsx` — brightness, colors, lighting overhaul
- `client/index.html` — background `#000` → `#0a1628`
- `App.jsx` — removed demo arcs, added TX stream/pool state, TX arcs, new component integration
- `components/HudPanels.jsx` — data source badge, removed old source label
- `components/VerificationOverlay.jsx` — TX section removed (Block only)
- `components/BlockDetailPanel.jsx` — TX list with API fetch + click-to-detail
- `components/ToggleBar.jsx` — removed Mempool button, renamed TX toggle
- `components/ChainStrip.jsx` — bottom position adjusted (`16` → `10`)

#### Files Removed
- `components/TxVerifyPanel.jsx` — replaced by TxStreamPanel hover tooltip
- `components/MempoolPanel.jsx` — replaced by MempoolPoolPanel

---

## [Unreleased] — 2026-03-18

### Added — Full Node Feature Coverage (Phase 1-4)

#### Phase 1: HUD Panel Enhancements
- Peer connection types: `FR:40 BR:5 F:3` (full-relay/block-relay-only/feeler)
- Security row: BIP324 v2 count, Tor/I2P peer count
- Time offset: median peer time offset with ±70min warning
- Services: NETWORK, WITNESS, COMPACT_FILTERS display
- UTXO stats: total count + chainstate size (5min cache)
- IBD banner: `SYNCING — 87.3%` when verificationProgress < 0.9999
- Difficulty adjustment: estimated change percentage (`▲+3.2%`)

#### Phase 2: Node Internals Panel (new)
- 6-tab panel: P2P Protocol, Storage, Security, Time, RPC/API, SPV
- P2P: peer discovery flowchart, handshake protocol, TX propagation, banning
- Storage: blk*.dat structure, disk usage, pruning status
- Security: BIP324, network diversity, ASN distribution, block-relay-only
- Time: MTP explanation, peer time offset table, warning thresholds
- RPC/API: JSON-RPC/ZMQ/REST interface explanation + live RPC method list
- SPV: Bloom Filter vs Compact Block Filter, privacy comparison

#### Phase 3: Verification Enhancements
- Block verification: 4→7 steps (added Timestamp, Coinbase, Weight)
- TX verification: 4→6 steps (added IsStandard, Double Spend Check)
- Mempool panel: orphan TX, RBF, eviction educational info

#### Phase 4: Advanced Visualization
- Compact Block Relay animation: 4-step decode process on new blocks
- Reorg detection: ChainTipsPanel highlights reverted blocks on tip change
- RPC/API tab: interface descriptions, use cases, live method list
- SPV tab: BIP 37 vs BIP 157/158 comparison

#### Server Endpoints (new)
- `GET /api/utxo-stats` — gettxoutsetinfo with 5min cache
- `GET /api/storage` — disk size, pruning status
- `GET /api/security` — v2 transport, network diversity, ASN count
- `GET /api/info` extended: peerTypes, v2Transport, medianTimeOffset, localServices, networks, estimatedChange

#### Files Added
- `components/NodeInternalsPanel.jsx` — 6-tab node internals panel
- `components/CompactBlockPanel.jsx` — compact block relay animation
- `docs/fullnode-features.md` — 13 feature category reference
- `CLAUDE.md` — project instructions

#### Files Modified
- `server/rpc.js` — added getTxOutSetInfo()
- `server/index.js` — 3 new endpoints + /api/info extension
- `server/validator.js` — coinbaseValue + weight in block data
- `datasource/ServerAdapter.js` — slow/med polling + extended nodeInfo
- `components/HudPanels.jsx` — 7 new rows (peers, security, time, services, UTXO, IBD)
- `components/ToggleBar.jsx` — internals toggle button
- `components/MempoolPanel.jsx` — policy education section
- `components/ChainTipsPanel.jsx` — reorg detection + reverted block display
- `components/BlockVerifyPanel.jsx` — 7-step support
- `verification/BlockVerificationState.js` — 4→7 steps
- `verification/TxVerificationState.js` — 4→6 steps
- `App.jsx` — new state, subscriptions, NodeInternalsPanel, CompactBlockPanel

---

### Added — Self-hosted Auto-Detection + Full Node Exclusive Data

#### Auto-Detection (Same-Origin Mode)
- On app load, client probes `/health` with a 2-second timeout
- If server responds OK → `ServerAdapter` activates in same-origin mode (relative paths, no popup)
- If server is unreachable → falls back to localStorage setting or mempool.space default
- Manual settings override still available via ⚙ Node Settings

#### Server: Full Node Exclusive Endpoints
- `GET /api/mempool/info` — `getmempoolinfo` result (policy: min fee, max size, current usage)
- `GET /api/chaintips` — `getchaintips` result (fork/stale/orphan block history)
- `GET /api/fees` — `estimatesmartfee` for 1/3/6 block targets, converted to sat/vB

#### Client: ServerAdapter Improvements
- `_wsUrl()` / `_restUrl()`: support empty `serverUrl` for same-origin relative paths
- REST polling extended: added `mempoolInfo`, `chaintips`, `fees` events (30s interval)
- `fees` event emitted in same format as MempoolAdapter for HUD compatibility

#### Client: HUD Panel Updates
- Mempool row: shows TX count + usage/max MB when `mempoolInfo` available (e.g. `45,123 tx (280/300 MB)`)
- New `Min Fee` row: displays `mempoolminfee` in sat/vB (server mode only)
- Data source label: dynamic — `mempool.space` or `self-hosted node`

#### Client: Chain Tips Panel (new component)
- `ChainTipsPanel.jsx`: displays fork and stale block history from `getchaintips`
- Active chain tip highlighted in green; forks color-coded by status (FORK / HEADERS / INVALID)
- Visible in server mode only, positioned top-right

#### Settings Panel
- Server mode with empty URL now connects as same-origin (no validation required)
- Shows `✓ Self-hosted (자동 감지)` banner when auto-detected
- URL input hint updated: "비워두면 same-origin"

### Changed
- `App.jsx`: initial `sourceType` is `null` during auto-detection; data source subscription skips until detection completes
- `App.jsx`: `handleConnect` resets `mempoolInfo` and `chaintips` state on source switch

### Files Modified
- `server/rpc.js` — added `getMempoolInfo()`, `getChainTips()`, `estimateSmartFee()`
- `server/index.js` — added `/api/mempool/info`, `/api/chaintips`, `/api/fees`
- `client/src/datasource/ServerAdapter.js` — same-origin support + new polling endpoints
- `client/src/App.jsx` — auto-detection + new state + new subscriptions
- `client/src/components/SettingsPanel.jsx` — same-origin connect + auto-detect badge
- `client/src/components/HudPanels.jsx` — mempoolInfo display + dynamic source label

### Files Added
- `client/src/components/ChainTipsPanel.jsx` — chain fork history visualization

---

## Earlier History

> Pre-2026-03-18 changes were not tracked in this changelog.
> See git log for full history.

### Architecture Milestones (from git history)
- Initial Canvas-based particle system → migrated to react-globe.gl 3D globe
- Electrum WSS adapter → replaced with direct Bitcoin Core RPC server (`ServerAdapter`)
- ZMQ real-time events + RPC polling fallback
- Merkle root block verification + script/signature TX verification overlays
- Bitnodes.io node data + real peer GeoIP locations
- Umbrel Docker packaging (`Dockerfile`, `docker-compose.yml`, `umbrel-app.yml`)
- Vercel public deployment (mempool.space mode)
