# Bitcoin Fullnode Visualizer

## 프로젝트 개요
비트코인 풀노드가 네트워크에서 수행하는 역할을 실시간 3D 시각화하는 교육용 웹앱.

## 기술 스택
- **프론트엔드**: React (Vite), react-globe.gl (Three.js)
- **백엔드**: Express + WebSocket (Node.js)
- **데이터 소스**: Bitcoin Core RPC/ZMQ (self-hosted) 또는 mempool.space API (Vercel)
- **배포**: Vercel (public) + Docker/Umbrel (self-hosted)

## 디렉토리 구조
```
app/
  server/         — Express 서버 (RPC, ZMQ, WebSocket)
  client/src/
    App.jsx       — 메인 앱 (상태 관리, 이벤트 라우팅)
    globe/        — 3D 지구본 (Three.js)
    components/   — UI 패널 (HUD, 검증, 멤풀 등)
    verification/ — 검증 상태 머신 (Block, TX)
    datasource/   — 데이터 어댑터 (EventBus, Server, Mempool)
```

## 핵심 패턴
- **EventBus pub/sub**: 모든 데이터 어댑터가 공통 이벤트 인터페이스 구현
- **상태 머신**: 블록/TX 검증은 타이머 기반 단계별 애니메이션
- **듀얼 모드**: Vercel(교육용) vs Self-hosted(실제 데이터)
- **DOM 오버레이**: position: absolute, z-index 8-20, rgba(5,8,16,0.88) bg

## 색상 규칙
- Orange `#f7931a` — Primary (HUD, ToggleBar)
- Purple `#a78bfa` — Block verification
- Blue `#93c5fd` — TX verification
- Green `#22c55e` — Mempool

## 실행
```bash
cd app && npm run dev      # 개발 서버
cd app && npm run build    # 프로덕션 빌드
```

## 참고
- 13개 풀노드 기능 카테고리: docs/fullnode-features.md
- 지갑 기능(#9)은 의도적 제외
