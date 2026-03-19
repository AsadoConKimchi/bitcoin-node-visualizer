# Bitcoin Full Node — 13개 기능 카테고리

풀노드가 수행하는 모든 기능을 카테고리별로 정리한 레퍼런스 문서.
각 기능별로 시각화 상태와 관련 RPC를 기록.

---

## 1. 피어 네트워크 관리 (P2P Network)
- 피어 발견: DNS seeds, peers.dat, hardcoded seeds
- 핸드셰이크: version/verack 교환
- 연결 유형: full-relay, block-relay-only, feeler, addr-fetch
- 악성 피어 차단: ban score 시스템
- **RPC**: getpeerinfo, getnetworkinfo, addnode, disconnectnode

## 2. 트랜잭션 처리 (Transaction Processing)
- TX 수신/검증/전파 (inv → getdata → tx → inv)
- 멤풀 관리: 수수료 기반 우선순위, RBF (BIP 125)
- 고아 TX 처리: 부모 TX 대기
- **RPC**: sendrawtransaction, getrawmempool, getmempoolentry

## 3. UTXO 세트 관리 (UTXO Set)
- chainstate LevelDB: 미사용 출력 추적
- UTXO 생성(vout) / 소비(vin)
- UTXO 세트 크기 모니터링
- **RPC**: gettxout, gettxoutsetinfo

## 4. 블록 처리 (Block Processing)
- 헤더 검증: version, prevHash, merkleRoot, nBits, nonce
- PoW 검증: hash < target
- Timestamp 검증: MTP < t < now+2h
- Coinbase 보상 검증: subsidy + fees ≤ expected
- Weight 제한: ≤ 4,000,000 WU
- Merkle root 재계산
- **RPC**: getblock, getblockheader, getbestblockhash

## 5. 블록체인 저장 (Blockchain Storage)
- blk*.dat: 원시 블록 데이터 (128MB/파일)
- rev*.dat: undo 데이터 (reorg용)
- blocks/index/: LevelDB 블록 인덱스
- Pruning: 오래된 블록 삭제 (pruneblockchain)
- **RPC**: getblockchaininfo, pruneblockchain

## 6. 초기 블록 다운로드 (IBD)
- Headers-first 동기화
- 병렬 블록 다운로드
- verificationProgress 진행률
- **RPC**: getblockchaininfo (verificationprogress)

## 7. 난이도 조정 (Difficulty Adjustment)
- 2016 블록 (약 2주)마다 조정
- actualTimespan / expectedTimespan 비율
- ±4배 제한 (0.25x ~ 4x)
- **RPC**: getblockchaininfo (difficulty), getblock (bits)

## 8. 수수료 추정 (Fee Estimation)
- 블록 목표별 수수료율 추정
- 멤풀 상태 기반 동적 조정
- **RPC**: estimatesmartfee

## 9. 지갑 기능 (Wallet) — 의도적 제외
- 이 앱의 범위 밖 (노드 역할 시각화가 목적)
- **RPC**: (해당 없음)

## 10. RPC/API 서비스 (Interfaces)
- JSON-RPC (8332): 범용 인터페이스
- ZMQ (28332/28333): 실시간 이벤트 스트리밍
- REST API (8332/rest/): 읽기 전용, 인증 불요

## 11. 경량 클라이언트 지원 (Light Client Support)
- Bloom Filter (BIP 37): 프라이버시 취약, deprecated
- Compact Block Filter (BIP 157/158): 프라이버시 보호
- SERVICE 플래그: NETWORK, WITNESS, COMPACT_FILTERS

## 12. 보안/프라이버시 (Security & Privacy)
- BIP324 v2 Transport: 암호화된 P2P 통신
- 네트워크 다양성: IPv4/IPv6/Tor/I2P/CJDNS
- Eclipse Attack 방어: ASN 다양성, block-relay-only
- **RPC**: getnetworkinfo (networks, localservicesnames)

## 13. 시간 관리 (Time Management)
- Median Time Past (MTP): 11개 블록 중앙값
- 피어 시간 오프셋: ±70분 경고
- 블록 타임스탬프 규칙: MTP < t < now+2h
- **RPC**: getpeerinfo (timeoffset)
