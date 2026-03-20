# Changelog

All notable changes to Bitcoin Node Visualizer are documented here.

---

## [1.1.1] — 2026-03-20

### Fixed — 서버 모드 버그 4건

#### Bug 1: TxDetailPanel — Fee "—", Sankey "???" 표시
- **근본 원인**: `getrawtransaction(txid, true)` = verbosity=1 → `vin[].prevout` 미포함
- `server/rpc.js`: verbosity `true` → `2`로 변경 (prevout 데이터 포함)
- `TxDetailPanel.jsx`: `normalizeRpcTx()` — `v.prevout.value` (BTC→sats), `v.prevout.scriptPubKey.address/type` 매핑 수정

#### Bug 2: TX 검증 상세보기 누락
- `TxStreamPanel.jsx`: TX 행에 🔍 상세보기 아이콘 추가
- 아이콘 클릭 시 `onTxClick()` → TxDetailPanel 모달 열림 (기존 행 클릭 = inline expansion 유지)

#### Bug 3: 노드 위치가 유럽으로 표시
- **근본 원인**: `.onion`/`.i2p` localaddress GeoIP 실패 → 피어 median fallback → 유럽 중앙 좌표
- `server/index.js`: `.onion`/`.i2p` 주소 필터링, 피어 median fallback 제거
- 외부 IP 감지 (`api.ipify.org`) → GeoIP → 캐시 (서버 시작 시 1회)
- `nodeData.js`: `nodeLocation` null 시 기본값(서울) 유지

#### Bug 4: BitfeedFloor 블록 레이아웃 빈 공간
- **근본 원인**: `COLUMN_COUNT=40` 고정 → 전체 너비에서 빈 공간 과다
- `BitfeedFloor.jsx`: 동적 컬럼 수 (`Math.floor(width / 12)` — 1400px → ~116컬럼)
- 좌측 정렬 (중앙 정렬 제거), 블록 간 1px 간격으로 밀집 배치
- 미확인 TX 영역 점선 구분선 추가

### Changed
- Docker 빌드: arm64 제거, amd64만 빌드 (Umbrel Home = Intel N100)
- GitHub Actions: QEMU setup 스텝 제거

### Deployment
- **Docker**: `v1.1.1` 태그 → GitHub Actions amd64 빌드 → GHCR push
- **Umbrel**: `umbrel-app-store` 레포 동기화 — version `1.1.0` → `1.1.1`

---

## [1.1.0] — 2026-03-20

### Changed — macOS 플로팅 패널 UI 대개편

MainPanel(화면 75%) 해체 → 독립 드래그 가능 MacWindow 패널 시스템으로 전환. 3D 지구본이 전체 배경으로 노출.

#### 신규 컴포넌트
- **MacWindow**: macOS 스타일 플로팅 패널 래퍼 (드래그, 최소화, 닫기)
- **useDrag 훅**: viewport 클램핑, 마우스/터치 드래그 지원
- **WindowDock**: 최소화된 윈도우 복원 Dock (하단 중앙)
- **TxTooltip**: BitfeedFloor 호버 시 컴팩트 6줄 TX 정보 카드
- **TxSankeyDiagram**: SVG Sankey input→output 흐름도

#### 패널 재구성
- TxStreamPanel, BlockVerifyPanel → 독립 MacWindow로 추출
- HudPanels, ChainStrip → MacWindow 래퍼 적용 (드래그 가능)
- BitfeedFloor → 전체 너비 하단 200px 바 (항상 표시)
- MainPanel.jsx 삭제

#### 비주얼 개선
- 수수료 색상: 4단계 → 6단계 그라데이션 (빨강/주황/노랑/초록/시안/파랑)
- TxDetailPanel: 600px 리디자인, Sankey 다이어그램 + 수수료 공식 카드
- settled 블록 투명도 0x88 → 0xCC (더 선명), 블록 테두리 제거
- frosted glass 24px blur + saturate, 스프링 전환 커브
- 타이포그래피 최소 11px 적용

---

## [1.0.4] — 2026-03-20

### Changed — UI 리디자인: macOS Dark Mode + Bitfeed 질감

순수 시각적 변경. 기능 로직 변경 없음. 19개 파일 수정.

#### 테마 전환
- 색온도: 따뜻한 회색(`rgba(40,40,45)`) → 쿨 슬레이트(`rgba(28,32,38)`)
- 폰트: `Courier New` → `SF Mono, JetBrains Mono, Fira Code`
- 멤풀 그린: `#34d399` → `#2dd4bf` (틸 방향, Bitfeed 스타일)
- 섀도: 단일 → macOS 이중 레이어 (`--shadow-panel-layered`, `--shadow-modal`)
- 트랜지션: `300ms ease-in-out` → `250ms cubic-bezier(0.4, 0, 0.2, 1)`
- 스크롤바: 오렌지 → `rgba(255,255,255,0.12)`
- body 기본 색상: `btc-orange` → `text-primary` (오렌지 과다 노출 해소)

#### 컴포넌트 변경
- **ToggleBar**: macOS Segmented Control 패턴 — `bg-white/12` 활성, 개별 border 제거
- **HudPanels**: Row 라벨 `text-text-secondary`, 간격 증가
- **UnifiedPanel**: `border-btc-orange/40` → `border-white/10`, `rounded-xl`, 내부 구분선 중립화
- **ChainStrip**: BlockCell 패딩 증가, PendingCell `border-white/8`
- **모달 패널** (Block/TX/Address/Settings): 오버레이 `bg-black/40 backdrop-blur-[2px]`, `--shadow-modal`, `border-white/10`
- **NodeInternalsPanel**: 세그먼트 컨트롤 탭바, 외곽 border 중립화
- **SearchBar**: border/텍스트 중립화, font-mono 제거
- **나머지** (BlockVerify, TxStream, ChainTips, CompactBlock, MempoolBlocks, MempoolPool): 동일 패턴 적용
- 전체: `tracking-widest` → `tracking-wide`, 하드코딩 `bg-[rgba()]` → theme var 통합

### Added — 앱 아이콘

- `favicon.svg` — Bitcoin ₿ + 지구본 와이어프레임 + P2P 노드 점 (쿨 다크 배경 + 오렌지 심볼 + 틸 노드)
- `favicon-32.png`, `icon-192.png`, `icon-512.png` — PNG 변환
- `index.html`에 favicon/apple-touch-icon/theme-color(`#141820`) 메타태그 추가
- 기존 favicon 404 에러 해소

### Deployment

- **Vercel**: main push → 자동 배포 (https://fullnode-visualizer.vercel.app)
- **Docker**: `v1.0.4` 태그 → GitHub Actions 멀티아키텍처(amd64/arm64) 빌드 → GHCR push
- **Umbrel**: `umbrel-app-store` 레포 동기화 — `umbrel-app.yml` version `1.0.3` → `1.0.4`, `docker-compose.yml` 이미지 태그 `v1.0.3` → `v1.0.4`

#### Files Modified (배포 관련)
- `docker-compose.yml` — 이미지 태그 `v1.0.3` → `v1.0.4`
- `umbrel-app.yml` — version `1.0.0` → `1.0.4`, releaseNotes 추가
- `umbrel-app-store` 레포 — 앱스토어용 `umbrel-app.yml` + `docker-compose.yml` 동기화

---

## [1.0.3] — 2026-03-20

### Fixed — Umbrel 시각화 버그 3건 근본 수정

#### Bug 1: 피어/연결선 안 보임
- **근본 원인**: 서버 자동감지 시 `setServerUrl('')` → `if (this._serverUrl)` falsy → 항상 mempool 모드로 실행
- `NodeDataManager`에 `isServerMode` 명시 플래그 추가 (3번째 인자)
- 서버 모드에서 bitnodes 외부 API 호출 스킵 — 실제 피어 + 내 노드만 표시
- `GlobeScene`: 서버 모드 시 `pointsData` → `htmlElementsData` (CSS glow DOM 요소)로 전환하여 가까운 피어 3D 구체 겹침 방지
- `/api/peers` 응답에 `geoResolved`/`total` 카운트 추가 (Tor/I2P 피어 GeoIP 미해결 가시화)

#### Bug 2: Mempool Floor TX 공중부양
- **근본 원인**: settled 재낙하 로직에서 같은 컬럼 여러 블록이 `cols[j] - selfContrib`으로 동일 expectedFloorY 계산 → 잘못된 재낙하
- 재낙하 로직 전체 제거: settled 블록은 영구 고정, `sweepBlocks()`만이 해제 가능

#### Bug 3: Merkle Tree 비어있음
- **근본 원인**: WS init에서 `getBlockHeader()`로 블록 가져옴 → TX 목록 미포함 → `txidSample` 누락
- `getBlock(hash, 1)` (verbosity 1: txid 목록 포함, TX 본문 미포함)로 변경
- `txidSample` 생성: ≤8개면 전체, 아니면 앞4+뒤4

### Added — 자립형 TX/블록 상세 + Floor TX 클릭

#### 서버 API 엔드포인트
- `GET /api/tx/:txid` — `getrawtransaction` verbose
- `GET /api/block/:hash` — `getblock` verbosity=1

#### 듀얼모드 상세 패널
- `TxDetailPanel`: `sourceType` prop으로 서버/mempool 모드 분기
  - 서버 모드: `/api/tx/:txid` → RPC 응답을 mempool.space 형식으로 정규화 (BTC→sat 변환, scriptPubKey 매핑)
  - mempool 모드: 기존 `mempool.space/api/tx` 유지
- `BlockDetailPanel`: 동일 듀얼모드 구현
  - 서버 모드: txid 목록이 블록 응답에 포함되므로 별도 fetch 불필요
- 서버 모드에서 "mempool.space에서 보기 ↗" 외부 링크 숨김

#### Mempool Floor TX 클릭
- `BitfeedFloor`: `onTxClick` prop + canvas click 핸들러 (역순 히트테스트)
- `MainPanel` → `BitfeedFloor`로 `onTxClick` 전달
- 클릭 시 `TxDetailPanel` 열림 (feeRate 데이터 포함)

#### Files Modified
- `server/index.js` — init 블록 txidSample, `/api/tx/:txid`, `/api/block/:hash`
- `globe/nodeData.js` — `isServerMode` 플래그, bitnodes 스킵
- `globe/GlobeScene.jsx` — `isServerMode` prop, htmlElementsData CSS glow
- `App.jsx` — NodeDataManager에 isServerMode, 상세패널에 sourceType
- `components/BitfeedFloor.jsx` — 재낙하 로직 제거, 클릭 핸들러
- `components/TxDetailPanel.jsx` — 듀얼모드 API, RPC 정규화, 링크 조건부
- `components/BlockDetailPanel.jsx` — 듀얼모드 API, RPC 정규화, 링크 조건부
- `components/MainPanel.jsx` — onTxClick을 BitfeedFloor에 전달

---

## [1.0.2] — 2026-03-20

### Fixed — P2P 시각화 버그 4건

- 피어 초록 점: `isMyPeer` 구분, `pointRadius`/`pointColor` 분기
- 연결선 아크: `connection`(0.15 stroke, 정적) vs `block`(1.5, 600ms) vs `tx`(0.6, 1200ms) 분화
- mempool 모드: 가상 피어 8~12개 bitnodes에서 랜덤 추출
- `MY_NODE` 기본 서울 좌표 (37.5665, 126.978)

---

## [1.0.1] — 2026-03-20

### Fixed — Umbrel 설치 실패

- Docker 빌드 수정

---

## [1.0.0] — 2026-03-20

### Added — Umbrel 앱스토어 패키징

- `Dockerfile` 멀티스테이지 빌드
- `umbrel-app.yml` + `docker-compose.yml` + `exports.sh`
- GitHub Actions: 태그 push → GHCR Docker 이미지 자동 빌드/배포

---

## [Pre-release] — 2026-03-20

### Changed — TX 실제 검증 파이프라인

#### 가짜 실패 제거
- `Math.random() < 0.03` 기반 3% 랜덤 실패 시뮬레이션 완전 제거
- `FAIL_REASONS`, `FAIL_STEPS`, `failChance`, `TX_FAIL_CHANCE` 상수 모두 삭제
- 정상 TX가 "이중 지불 감지" 등으로 잘못 표시되던 문제 해결

#### 2-Phase TX Processing (서버)
- Phase 1 (즉시): 기존과 동일하게 `broadcast('tx', basicSummary)`
- Phase 2 (비동기): `verifyTx()` → `broadcast('tx:verified', result)` — Bitcoin Core RPC 기반 실제 검증
- RPC 세마포어 (MAX_CONCURRENT_RPC = 5) — Bitcoin Core 과부하 방지

#### 6단계 실제 검증 (`verifyTx`)
| Step | 검증 항목 | 데이터 소스 | 실패 조건 |
|------|----------|-----------|----------|
| 0 | 구문 파싱 | bitcoinjs-lib parse | 파싱 예외 |
| 1 | IsStandard 검사 | classifyOutput() | 'nonstandard' 스크립트 |
| 2 | UTXO 조회 | getrawtransaction verbose → vin[].prevout | prevout null |
| 3 | 이중 지불 검사 | getmempoolentry → depends, bip125 | 멤풀 제거 |
| 4 | 서명 검증 | witness 구조 분석 | witness 비정상 |
| 5 | 금액 합산 | prevout 합계 vs output 합계 | fee < 0 |

#### 클라이언트 검증 상태 머신 개선
- `TxVerificationState.injectVerification(result)` — 서버 실제 검증 결과 주입
- 타이머 애니메이션 중 서버 데이터 도착 시 실제 detail로 업데이트
- `_failAtReal(step, reason)` — 실제 실패 시 이후 타이머 무효화
- mempool.space 모드: `tx:verified` 이벤트 없음 → 기본 성공 텍스트 표시

#### Edge Cases
- RPC 실패/타임아웃 → fallback "RPC 건너뜀" (기본 성공)
- Bitcoin Core < 22 → `vin[].prevout` null check 대응
- TX가 검증 전 블록 포함 → catch에서 처리

---

## [Pre-release] — 2026-03-19

### Fixed — 서버 감지 + 노드 연결 증명

#### Continuous Server Detection
- 마운트 시 3회 한정 health check → **5초 간격 지속적 폴링**으로 변경
- 서버가 늦게 시작되어도 자동 감지 → `mempool` → `server` 자동 전환
- 서버 발견 후 10초 간격 health 확인 유지 (서버 다운 감지 대비)
- 첫 감지 실패 시 즉시 mempool 모드로 시작 (빈 화면 방지)

#### Server Init — recentBlocks + txPerSec
- 서버 WS init에 최근 블록 5개 헤더 포함 (`getblockheader` RPC)
  - `hash`, `height`, `txCount`, `version`, `time`, `nBits`, `nonce`, `merkleRoot`
- `ServerAdapter`에 txPerSec 실시간 계산 (1초 슬라이딩 윈도우)
- Demo 블록(height===0) 검증 중일 때 실제 블록 도착 시 자동 교체

#### Node Identity Proof (NODE INFO 패널)
- 서버 모드: 노드 버전(`Satoshi:28.x.x`), 피어 수(`12 peers (8↑ 4↓)`), best block hash tip 표시
- mempool 모드 + connecting: `⟳ 서버 감지 중...` 인디케이터 표시
- best block hash는 `title` 속성으로 전체 해시 확인 가능

#### Files Modified
- `client/src/App.jsx` — 지속적 서버 감지, bestBlockHash 상태, Demo 블록 자동 교체
- `client/src/components/HudPanels.jsx` — 노드 신원 정보 + 서버 감지 인디케이터
- `client/src/datasource/ServerAdapter.js` — txPerSec 슬라이딩 윈도우 계산
- `server/index.js` — init에 recentBlocks 5개 (getblockheader 체인 순회)
- `server/rpc.js` — `getBlockHeader()` 래퍼 추가

---

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

## [Pre-release] — 2026-03-18

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
