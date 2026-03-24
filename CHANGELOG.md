# Changelog

All notable changes to Bitcoin Node Visualizer are documented here.

---

## [1.6.1] — 2026-03-24

### Changed — BlockDetailPanel: 너비 확장 + 폰트 확대 + 빈 공간 제거

v1.6.0에서 우측 컬럼(320px)이 너무 좁아 BTC/MWU/KB 등 값이 잘리고, aspect-square Treemap이 과도한 하단 빈 공간을 만들던 문제 해결.

#### 모달 & 컬럼 확장
- 모달: `max-w-[1200px]` → `max-w-[1400px]`
- 우측 컬럼: `w-[320px]` → `w-[400px]` — 값 잘림 해소 (3.12500000 BTC, 1512.5 KB 등 완전 표시)

#### Treemap 높이 고정
- `aspect-square` (~840px 정사각형) → `h-[420px]` 고정 높이
- 하단 빈 공간 ~400px → ~100px로 대폭 감소

#### 폰트 확대 (12px → 14px)
- InfoRow: label/value `text-xs` → `text-sm`, mono value `text-label` → `font-mono text-xs`
- SegwitStats: 타이틀/범례 `text-xs` → `text-sm`
- FeeBar: 타이틀/min·mid·max `text-xs` → `text-sm`
- DETAILS/TRANSACTIONS 아코디언 버튼: `text-xs` → `text-sm`

#### 변경하지 않은 것
- TX 목록 아이템 (`text-xs` 유지), FeeBar 바 라벨 (`text-label-xs` 유지)
- 모바일 breakpoint, 색상/아이콘/다크 사이버펑크 미학

### Files Modified
- `client/src/components/BlockDetailPanel.jsx`

---

## [1.6.0] — 2026-03-24

### Changed — BlockDetailPanel: 전체 화면 블록 탐색기 리디자인

기존 780px 모달에서 Treemap이 우측 ~280px에 갇혀 3,000+ TX 시각화가 불가능했던 문제 해결.

#### 모달 크기 확대
- `w-[780px]` → `w-[95vw] max-w-[1200px]` — 전체 화면급 블록 탐색기

#### TX Fee Rate Map — 전체 너비 배치
- 기존: 우측 col-span-2 안 280px × 200px (3,000 TX 시 대부분 미표시)
- 변경: 모달 상단 **전체 너비 × 250px** (모바일 180px)
- 셀 크기 자동 계산: `Math.sqrt(area / total)` — TX 수에 관계없이 빈 공간 최소화
- gap: 0으로 밀집 표현

#### Canvas 렌더링 안정화
- `requestAnimationFrame`으로 한 프레임 지연 (부모 레이아웃 완료 후 측정)
- `containerRef.offsetWidth` 기준 정확한 크기 측정 (기존 `clientWidth` 불안정)
- Canvas className `w-full h-full` → `block` (CSS 충돌 방지)

#### 레이아웃 재구성
- 기존: 5열 그리드 (좌 3열 정보 + 우 2열 Treemap)
- 변경: Treemap(상단 풀 블리드) → 2열 그리드(좌: 블록 메타 / 우: TX 유형 + Fee 분포)

### Files Modified
- `client/src/components/BlockDetailPanel.jsx` — 모달 크기, 레이아웃, Canvas 로직 전면 수정

---

## [1.3.0] — 2026-03-21

### Changed — UI Overhaul: mempool.space 수준의 상세 패널 + 검증 시각화 개선

교육적 목적에 맞게 정보 밀도와 시각적 품질을 mempool.space 수준으로 대폭 개선.

#### Sprint 1: TX Detail + Sankey 재설계
- **TxSankeyDiagram**: N*M stroke 경로 → **filled-area cubic bezier Sankey** 완전 재작성
  - purple-blue 그라데이션 (mempool.space 스타일)
  - SVG viewBox 360px → 520px, 8개 초과 시 "…N more" 요약 바
  - "Hide diagram" 토글 버튼 추가
- **TxDetailPanel**: 600px → **720px**, 5개 섹션 구조로 재설계
  - Header: TXID + CopyButton + 확인 배지 (Confirmed/Unconfirmed)
  - Info Grid: 2열 CSS grid (Timestamp, Fee, Fee Rate, Size, Vsize, Weight)
  - Feature 배지: SegWit/Taproot/RBF/OP_RETURN/Multisig 자동 감지 (colored pill)
  - Inputs & Outputs: 2열 나란히 배치 (빨간/초록 원 + 스크립트 타입 배지)
  - Details: 접이식 (Version, Locktime)
  - `normalizeRpcTx`에 `version`, `locktime` 필드 추가
  - 주소 클릭 → `onAddressClick` → AddressDetailPanel 이동

#### Sprint 2: Block Detail 재설계
- **BlockDetailPanel**: 400px → **780px**, 2열 레이아웃으로 재설계
  - Block Navigation: "< Block #941,513 >" prev/next 화살표
  - 좌측(~45%): Hash+Copy, Timestamp(절대+상대), Size, Weight, Fee span, Total fees, Subsidy+fees, Miner
  - 우측(~55%): **Block Treemap** (TX fee rate별 색상 사각형 시각화) + Fee 분포 차트
  - Details: 접이식 (Difficulty, Nonce, Bits, Merkle root, Previous block hash)
  - TX 목록: Coinbase TX 식별, 페이지네이션 유지
  - `calculateSubsidy(height)` — 블록 보상 계산 유틸 추가

#### Sprint 3: TX Verification 시각화 개선
- **TxStreamPanel**: MiniProgress 6px 도트 → **StepProgressBar** 교체
  - 120px 너비, 8px 높이 세그먼트 바
  - 색상: waiting(#1e2328), active(pulsing #f7931a), done(#22c55e), fail(#ef4444)
  - **바 아래 현재 단계명 텍스트 표시** (핵심 개선: "서명 검증 중…")
  - active 세그먼트: CSS `@keyframes stepPulse` 애니메이션
  - 인라인 상세: 현재 active step에 하이라이트 배경색

#### Sprint 4: Chain Strip 가로 상단 배치
- **ChainStrip**: MacWindow 세로(200×380px) → **가로 상단 바**로 완전 재설계
  - `position: absolute; top: 40px` (ToggleBar 아래)
  - 블록 카드: 130px 너비, fee rate, TX 수, 채굴풀, 경과 시간 표시
  - 최신 블록 좌측 강조 (150px, orange 테두리)
  - 블록 간 연결선 (수평선) + PendingCard
  - 수평 스크롤: 좌측으로 스크롤하면 과거 블록 lazy load
  - MacWindow props 제거 (minimized, onClose, onMinimize, zIndex 등)

#### 공유 유틸리티 (새 파일)
- `client/src/utils/format.jsx`:
  - `relativeTime(unixTimestamp)` — "3h ago" 상대 시간
  - `calculateSubsidy(height)` — 블록 보상 sats
  - `formatBtc(sats)` — BTC 포맷
  - `shortAddr(addr)` — 주소 축약
  - `CopyButton` — 클립보드 복사 컴포넌트
  - `detectTxFeatures(vin, vout)` — SegWit/Taproot/RBF 감지
  - `scriptTypeLabel(type)` — 스크립트 타입 표시

#### App.jsx 변경
- `windowStates`에서 `chain` 제거 (더 이상 MacWindow가 아님)
- TxDetailPanel에 `onAddressClick` prop → `setSelectedAddress` 연결
- BlockDetailPanel에 `onAddressClick` prop → `setSelectedAddress` 연결
- ChainStrip: `visible={visible.p2p}` prop으로 P2P 모드 시만 표시

### Deployment
- **Vercel**: main push → 자동 배포
- **Docker**: `v1.3.0` 태그 → GitHub Actions amd64 빌드 → GHCR push
- **Umbrel**: `umbrel-app-store` 레포 동기화 — version `1.2.0` → `1.3.0`

#### 배포 절차 (향후 참고)
1. `cd app && npm run build` — 빌드 확인
2. 메인 레포 커밋 & 푸시 (`git push origin main`)
3. 태그 생성 & 푸시 (`git tag v1.X.0 && git push origin v1.X.0`)
   → `.github/workflows/docker-publish.yml`가 자동 트리거
   → GitHub Actions에서 amd64 Docker 이미지 빌드 → `ghcr.io/asadoconkimchi/bitcoin-node-visualizer:vX.X.X` push
4. `gh run watch <run-id> --exit-status`로 빌드 완료 대기
5. Umbrel 앱스토어 레포 업데이트:
   - `umbrel-app-store/asadoconkimchi-bitcoin-node-visualizer/umbrel-app.yml` — version, releaseNotes
   - `umbrel-app-store/asadoconkimchi-bitcoin-node-visualizer/docker-compose.yml` — image 태그
   - 커밋 & 푸시 (`git push origin main`)

### Files Modified
- `client/src/utils/format.jsx` — 신규 (공유 유틸)
- `client/src/components/TxSankeyDiagram.jsx` — 완전 재작성
- `client/src/components/TxDetailPanel.jsx` — 완전 재작성
- `client/src/components/BlockDetailPanel.jsx` — 완전 재작성
- `client/src/components/TxStreamPanel.jsx` — MiniProgress → StepProgressBar
- `client/src/components/ChainStrip.jsx` — 가로 배치 완전 재작성
- `client/src/App.jsx` — ChainStrip 배치 변경, onAddressClick 연결
- `client/src/styles/main.css` — stepPulse 애니메이션 추가

---

## [1.2.0] — 2026-03-20

### Changed — 디자인 크리틱 9가지 UX 개선 + TX 데이터 정확성 수정

v1.1.1 디자인 리뷰 피드백 반영. 패널 레이아웃, 정보 밀도, 탐색 UX 전면 개선.

#### 1. ToggleBar 라디오 모드
- P2P / 검증센터 / Internals 중 **하나만 활성** (기존: 동시 활성 → 지구본 가림)
- 모드 전환 시 관련 패널 자동 show/hide (NODE INFO + CHAIN = P2P 전용)
- `block:received` 이벤트도 라디오 모드 준수 (검증센터로 자동 전환)

#### 2. NODE INFO 컴팩트 모드
- 기본 6줄 (Chain, Height, Fee, Mempool, Peers, TX/s)
- "▸ 상세" 토글로 Min Fee, Diff Adj, Security, Time, Services, UTXO 확장

#### 3. CHAIN TIPS 축약
- ACTIVE + 최근 2개 fork/headers만 기본 표시
- "N tips 전체 보기 ▾" 확장 토글 추가

#### 4. BitfeedFloor 블록 최소 크기 상향
- 최소 크기: 8px → **14px** (작은 TX도 가시성 확보)
- TXID 텍스트 표시: 16px → **25px** 이상에서만 (가독성 개선)

#### 5. Internals 아이콘 변경
- ⚙ → 🔧 (Settings ⚙와 구분)

#### 6. P2P 아크 연결선 클리핑 수정
- 피어 연결선 altitude: 0.08 → **0.15** (지구본 뒤로 갈 때 짤림 방지)
- `arcAltitudeAutoScale(0.3)` 추가

#### 7. 검색창 크기 확대
- 기본: 220px → **280px**, 포커스: 320px → **420px**
- 폰트: text-xs → **text-sm**

#### 8. ChainStrip 제네시스까지 스크롤
- 상하 스크롤 가능한 리스트로 변경 (고정 높이 380px)
- 위로 스크롤 시 mempool.space API로 이전 블록 10개씩 lazy load
- `previousblockhash` 체이닝으로 제네시스(height=0)까지 도달 가능

#### 9. MacWindow UX 개선
- **9a**: 초록 버튼(expand) 클릭 → 뷰포트 전체 최대화/복원 토글
- **9b**: 드래그 시 텍스트 선택 방지 (이미 useDrag.js에 구현 확인)

### Fixed — TX 상세 패널 서버 모드 데이터 정확성

#### 서버 사이드 prevout/fee 보강 (`server/index.js`)
- `getrawtransaction` verbosity=2 응답에 `prevout` 누락 시 → 각 input의 이전 TX 개별 조회
- `fee` 누락 시 → prevout 합계 - vout 합계 계산, 또는 `getmempoolentry` fallback

#### 클라이언트 정규화 개선 (`TxDetailPanel.jsx`)
- `isCoinbase` 플래그로 실제 coinbase와 데이터 누락 구분 (기존: 모두 "coinbase" 표시)
- prevout 없는 일반 input → `txid:vout` 참조 표시
- 클라이언트 fee 자체 계산 fallback 추가
- Sankey 다이어그램 input 라벨 동일 수정

### Deployment
- **Vercel**: main push → 자동 배포 (https://fullnode-visualizer.vercel.app)
- **Docker**: `v1.2.0` 태그 → GitHub Actions amd64 빌드 → GHCR push
- **Umbrel**: `umbrel-app-store` 레포 동기화 — version `1.1.1` → `1.2.0`

### Files Modified
- `client/src/App.jsx` — 라디오 모드 토글, block:received 모드 전환
- `client/src/components/ToggleBar.jsx` — Internals 아이콘 🔧
- `client/src/components/HudPanels.jsx` — 컴팩트/확장 모드
- `client/src/components/ChainTipsPanel.jsx` — 축약 + 확장 토글
- `client/src/components/BitfeedFloor.jsx` — 최소 크기 14px, TXID 25px
- `client/src/globe/GlobeScene.jsx` — 아크 altitude 상향
- `client/src/components/SearchBar.jsx` — 크기 확대 + font-size
- `client/src/components/ChainStrip.jsx` — 스크롤 + lazy load
- `client/src/components/MacWindow.jsx` — 최대화 버튼
- `client/src/components/TxDetailPanel.jsx` — coinbase 구분, fee 계산
- `server/index.js` — prevout/fee 보강 로직

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
