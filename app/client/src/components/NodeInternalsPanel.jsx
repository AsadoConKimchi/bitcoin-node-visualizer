import React, { useState } from 'react';

const TABS = [
  { key: 'p2p', label: 'P2P 네트워크' },
  { key: 'storage', label: '저장소' },
  { key: 'utxo', label: 'UTXO 셋' },
  { key: 'security', label: '보안' },
  { key: 'time', label: '시간' },
  { key: 'rpc', label: 'RPC/API' },
  { key: 'spv', label: 'SPV 검증' },
];

function TabBar({ active, onSelect }) {
  return (
    <div className="flex gap-0.5 mb-2.5 bg-white/5 rounded-lg p-0.5
                    overflow-x-auto max-sm:flex-nowrap max-sm:whitespace-nowrap flex-wrap">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={`text-xs px-2.5 py-1.5 rounded-md cursor-pointer transition-colors focus-ring shrink-0
                     max-sm:px-3 max-sm:py-2
                     ${active === key
                       ? 'bg-white/12 text-white font-medium shadow-sm border-b-2 border-btc-orange'
                       : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                     }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="text-text-secondary text-label-sm tracking-wide mt-2.5 mb-1">
      {children}
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div className="flex justify-between py-0.5 gap-2">
      <span className="text-muted text-sm">{label}</span>
      <span className={`text-sm ${color || 'text-text-primary'}`}>{value ?? '—'}</span>
    </div>
  );
}

function DiagramBox({ children, border = 'border-muted-dim' }) {
  return (
    <div className={`bg-dark-surface border ${border} rounded px-2.5 py-2 mb-1.5
                    text-xs leading-relaxed`}>
      {children}
    </div>
  );
}

// ── P2P Protocol ──
function P2PTab({ sourceType, nodeInfo }) {
  const isServer = sourceType === 'server';

  return (
    <div>
      <SectionTitle>▸ 피어 발견 (PEER DISCOVERY)</SectionTitle>
      <DiagramBox border="border-mempool-green/25">
        <div className="text-mempool-green">
          <div>[peers.dat] → 이전 세션 피어 목록</div>
          <div className="text-muted">  ↓ 실패 시</div>
          <div>[DNS Seeds] → seed.bitcoin.sipa.be 등 9개</div>
          <div className="text-muted">  ↓ 실패 시</div>
          <div>[Hardcoded Seeds] → 최후 수단 IP 목록</div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ 핸드셰이크 (HANDSHAKE)</SectionTitle>
      <DiagramBox border="border-tx-blue/25">
        <div className="text-tx-blue">
          <div>→ version (높이, 버전, 서비스)</div>
          <div>← version</div>
          <div>→ verack</div>
          <div>← verack</div>
          <div className="text-success">✓ 연결 완료</div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ TX 전파 (MESSAGE FLOW)</SectionTitle>
      <DiagramBox border="border-warning/25">
        <div className="text-warning">
          <div>← inv (txid 알림)</div>
          <div>→ getdata (요청)</div>
          <div>← tx (데이터 수신)</div>
          <div>→ inv (다른 피어에 전파)</div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ 악성 피어 차단 (BANNING)</SectionTitle>
      <DiagramBox border="border-error/25">
        <div className="text-red-400">
          <div>프로토콜 위반 → ban score 증가</div>
          <div>score ≥ 100 → 24시간 차단</div>
          <div className="text-muted text-label-xs">
            예: 잘못된 블록 전송(+100), 이중 지불 시도(+100)
          </div>
        </div>
      </DiagramBox>

      {isServer && nodeInfo?.peerTypes && (
        <>
          <SectionTitle>▸ 현재 피어 연결</SectionTitle>
          <InfoRow label="Full-Relay" value={nodeInfo.peerTypes.fullRelay} />
          <InfoRow label="Block-Relay-Only" value={nodeInfo.peerTypes.blockRelayOnly} />
          <InfoRow label="Feeler" value={nodeInfo.peerTypes.feeler} />
          <InfoRow label="Addr-Fetch" value={nodeInfo.peerTypes.addrFetch} />
        </>
      )}
    </div>
  );
}

// ── Storage ──
function StorageTab({ sourceType, storageInfo, blockHeight }) {
  const isServer = sourceType === 'server';

  return (
    <div>
      <SectionTitle>▸ 블록 저장 구조</SectionTitle>
      <DiagramBox border="border-btc-orange/25">
        <div className="text-btc-orange">
          <div>blocks/blk00000.dat — 원시 블록 데이터</div>
          <div>blocks/blk00001.dat — (최대 128MB/파일)</div>
          <div>blocks/rev00000.dat — undo 데이터 (reorg용)</div>
          <div>blocks/index/     — LevelDB 블록 인덱스</div>
          <div className="mt-1 text-muted">
            chainstate/        — UTXO 세트 (LevelDB)
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ blk*.dat 파일 내부 구조</SectionTitle>
      <DiagramBox border="border-block-purple/25">
        <div className="text-block-purple">
          <div>[매직 바이트 4B] [블록 크기 4B]</div>
          <div>[블록 헤더 80B]</div>
          <div>[TX 수 varint] [TX 데이터...]</div>
          <div className="text-muted text-label-xs mt-1">
            파일당 최대 128MB. 순차 기록, 무작위 접근은 index/ LevelDB로.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ Pruning (가지치기)</SectionTitle>
      <DiagramBox border="border-warning/25">
        <div className="text-warning">
          <div>prune=550 → 최소 550MB 유지</div>
          <div className="text-muted text-label-xs">
            오래된 블록 데이터 삭제. UTXO 세트는 항상 유지.
            가지치기된 노드도 새 블록/TX 검증 가능.
            단, 과거 블록 제공 불가 → 다른 노드의 IBD 도움 불가.
          </div>
        </div>
      </DiagramBox>

      {isServer && storageInfo ? (
        <>
          <SectionTitle>▸ 현재 스토리지</SectionTitle>
          <InfoRow label="체인 크기" value={storageInfo.sizeOnDisk != null ? `${(storageInfo.sizeOnDisk / 1e9).toFixed(1)} GB` : null} />
          <InfoRow label="블록 수" value={storageInfo.blocks?.toLocaleString()} />
          <InfoRow label="헤더 수" value={storageInfo.headers?.toLocaleString()} />
          <InfoRow
            label="Pruning"
            value={storageInfo.pruned ? `ON (${storageInfo.pruneHeight?.toLocaleString()} ~)` : 'OFF (풀 아카이브)'}
            color={storageInfo.pruned ? 'text-warning' : 'text-success'}
          />
        </>
      ) : (
        <>
          <SectionTitle>▸ 체인 크기 추정</SectionTitle>
          <InfoRow
            label="예상 크기"
            value={blockHeight != null ? `~${((blockHeight * 1.5) / 1000).toFixed(0)} GB` : null}
          />
          <div className="text-muted text-label-xs mt-1">
            평균 블록 크기 ~1.5MB 기준 추정치
          </div>
        </>
      )}
    </div>
  );
}

// ── UTXO 세트 ──
function UTXOTab({ sourceType, utxoStats, blockHeight }) {
  return (
    <div>
      <SectionTitle>▸ UTXO 세트란?</SectionTitle>
      <DiagramBox border="border-btc-orange/25">
        <div className="text-btc-orange">
          <div>Unspent Transaction Output</div>
          <div className="text-muted text-label-xs mt-1">
            아직 소비되지 않은 모든 TX 출력의 집합.
            풀노드가 TX 검증 시 이중 지불 여부를 판단하는 핵심 데이터.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ UTXO 생성과 소비</SectionTitle>
      <DiagramBox border="border-mempool-green/25">
        <div className="text-mempool-green">
          <div>TX 출력(vout) 생성 → UTXO 추가</div>
          <div>TX 입력(vin) 소비 → UTXO 제거</div>
          <div className="text-muted text-label-xs mt-1">
            각 블록은 UTXO를 추가하고 제거합니다.
            블록 내 coinbase TX는 새 UTXO만 생성합니다.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ chainstate 데이터베이스</SectionTitle>
      <DiagramBox border="border-tx-blue/25">
        <div className="text-tx-blue">
          <div>LevelDB 키-값 저장소</div>
          <div className="text-muted text-label-xs mt-1">
            키: TXID + vout 인덱스{'\n'}
            값: 코인 높이, coinbase 여부, 금액, 스크립트{'\n'}
            메모리에 캐시 → dbcache=450 (MB, 기본값)
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ UTXO 세트 증가 추세</SectionTitle>
      <DiagramBox border="border-warning/25">
        <div className="text-warning text-label-xs">
          <div>2009: ~0 UTXO</div>
          <div>2017: ~50M UTXO (~3 GB)</div>
          <div>2024: ~170M UTXO (~11 GB)</div>
          <div className="text-muted mt-1">
            UTXO 통합(consolidation)은 세트 크기를 줄이고 수수료를 절약합니다.
            Ordinals/BRC-20은 UTXO 증가를 가속화했습니다.
          </div>
        </div>
      </DiagramBox>

      {utxoStats?.txouts != null && (
        <>
          <SectionTitle>▸ 현재 UTXO 세트</SectionTitle>
          <InfoRow label="UTXO 수" value={utxoStats.txouts?.toLocaleString()} />
          <InfoRow label="디스크 크기" value={utxoStats.diskSize != null ? `${(utxoStats.diskSize / 1e9).toFixed(1)} GB` : null} />
          <InfoRow label="총 금액" value={utxoStats.totalAmount != null ? `${(utxoStats.totalAmount / 1e8).toFixed(2)} BTC` : null} />
          <InfoRow label="블록 높이" value={blockHeight?.toLocaleString()} />
        </>
      )}
    </div>
  );
}

// ── Security ──
function SecurityTab({ sourceType, securityInfo, nodeInfo }) {
  const isServer = sourceType === 'server';

  return (
    <div>
      <SectionTitle>▸ BIP324 v2 Transport</SectionTitle>
      <DiagramBox border="border-block-purple/25">
        <div className="text-block-purple">
          <div>암호화된 P2P 통신 (Bitcoin Core 26.0+)</div>
          <div className="text-muted text-label-xs">
            중간자 공격 방어, 트래픽 분석 차단
          </div>
          {isServer && nodeInfo?.v2Transport != null && (
            <div className="text-success mt-1">현재 v2 피어: {nodeInfo.v2Transport}개</div>
          )}
        </div>
      </DiagramBox>

      <SectionTitle>▸ BIP324 핸드셰이크 플로우</SectionTitle>
      <DiagramBox border="border-block-purple/25">
        <div className="text-block-purple text-label-xs">
          <div>1. 개시자 → EllSwift 공개키 (64B)</div>
          <div>2. 응답자 → EllSwift 공개키 (64B)</div>
          <div>3. ECDH → 공유 비밀 생성</div>
          <div>4. ChaCha20-Poly1305 암호화 시작</div>
          <div className="text-muted mt-1">
            v1(평문)과 달리 ISP나 중간자가 P2P 메시지를 읽을 수 없음.
            Garbage 데이터로 프로토콜 핑거프린팅도 방어.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ Eclipse Attack 방어</SectionTitle>
      <DiagramBox border="border-error/25">
        <div className="text-red-400 text-label-xs">
          <div className="font-bold mb-1">공격: 모든 피어 연결을 장악하여 노드를 고립</div>
          <div className="text-mempool-green">방어 메커니즘:</div>
          <div>• 다양한 네트워크 사용 (IPv4 + Tor + I2P)</div>
          <div>• Block-Relay-Only 연결 2개 (TX 미공유)</div>
          <div>• Anchor 연결 (재시작 시 기존 피어 우선)</div>
          <div>• ASN 다양성 (같은 ISP 피어 제한)</div>
          <div className="text-muted mt-1">
            피어 테이블을 시드별로 버킷화하여 단일 공격자가
            전체 테이블을 점유하기 어렵게 설계.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ 네트워크 다양성</SectionTitle>
      <DiagramBox border="border-mempool-green/25">
        <div>
          <div className="text-mempool-green">IPv4/IPv6 — 기본 네트워크</div>
          <div className="text-block-purple">Tor (.onion) — IP 은닉</div>
          <div className="text-blue-400">I2P — 분산 익명 네트워크</div>
          <div className="text-warning">CJDNS — 메시 네트워크</div>
          <div className="text-muted text-label-xs mt-1">
            다양한 네트워크 = Eclipse Attack 방어력 ↑
          </div>
        </div>
      </DiagramBox>

      {isServer && securityInfo && (
        <>
          <SectionTitle>▸ 현재 보안 상태</SectionTitle>
          {securityInfo.networks && Object.entries(securityInfo.networks).map(([name, info]) => (
            <InfoRow
              key={name}
              label={name}
              value={info.reachable ? '활성' : '비활성'}
              color={info.reachable ? 'text-success' : 'text-muted'}
            />
          ))}
          <InfoRow label="고유 ASN 수" value={securityInfo.uniqueASNs} color={securityInfo.uniqueASNs > 5 ? 'text-success' : 'text-warning'} />
          <InfoRow label="Block-Relay-Only" value={securityInfo.blockRelayOnly} />
          {securityInfo.localServices?.length > 0 && (
            <InfoRow label="Services" value={securityInfo.localServices.join(', ')} />
          )}

          {/* 네트워크 파이차트 (텍스트 기반) */}
          {securityInfo.networks && (() => {
            const nets = Object.entries(securityInfo.networks).filter(([, v]) => v.reachable);
            if (nets.length <= 1) return null;
            return (
              <>
                <SectionTitle>▸ 네트워크별 피어 분포</SectionTitle>
                <div className="flex gap-2 flex-wrap text-label-xs">
                  {nets.map(([name]) => (
                    <span key={name} className="bg-dark-surface border border-dark-border rounded px-1.5 py-0.5">
                      {name}
                    </span>
                  ))}
                </div>
              </>
            );
          })()}
        </>
      )}

      <SectionTitle>▸ Block-Relay-Only 연결</SectionTitle>
      <div className="text-muted text-label-xs">
        TX를 공유하지 않는 비밀 연결. 네트워크 토폴로지를 은닉하여 Eclipse Attack 방어.
        Bitcoin Core는 자동으로 2개의 block-relay-only 연결을 유지.
      </div>
    </div>
  );
}

// ── Time ──
function TimeTab({ sourceType, nodeInfo }) {
  const isServer = sourceType === 'server';

  return (
    <div>
      <SectionTitle>▸ 시간 관리의 중요성</SectionTitle>
      <DiagramBox border="border-warning/25">
        <div className="text-warning">
          <div>블록 타임스탬프 검증 규칙:</div>
          <div className="ml-2">1. MTP {'>'} 지난 11개 블록 중앙값</div>
          <div className="ml-2">2. timestamp {'<'} 현재 시간 + 2시간</div>
          <div className="text-muted text-label-xs mt-1">
            시간 조작 → 난이도 조작 → 체인 공격 가능
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ Median Time Past (MTP)</SectionTitle>
      <DiagramBox border="border-tx-blue/25">
        <div className="text-tx-blue">
          <div>최근 11개 블록의 타임스탬프 중앙값</div>
          <div className="text-muted text-label-xs mt-1">
            새 블록의 타임스탬프는 반드시 MTP보다 커야 함.
            시간이 역행하는 것을 방지하는 합의 규칙.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ 피어 시간 오프셋</SectionTitle>
      <DiagramBox border="border-error/25">
        <div className="text-red-400">
          <div>경고 임계값: ±70분 (4,200초)</div>
          <div className="text-muted text-label-xs">
            오프셋 초과 시 → 블록 검증 거부 가능
            → "Your clock is behind" 경고 발생
          </div>
        </div>
      </DiagramBox>

      {isServer && nodeInfo?.medianTimeOffset != null && (
        <>
          <SectionTitle>▸ 현재 시간 상태</SectionTitle>
          <InfoRow
            label="중앙값 오프셋"
            value={`${nodeInfo.medianTimeOffset >= 0 ? '+' : ''}${nodeInfo.medianTimeOffset}s`}
            color={Math.abs(nodeInfo.medianTimeOffset) > 4200 ? 'text-error' : 'text-success'}
          />
        </>
      )}
    </div>
  );
}

// ── RPC/API ──
function RPCTab({ sourceType }) {
  return (
    <div>
      <SectionTitle>▸ 풀노드 인터페이스 3가지</SectionTitle>

      <DiagramBox border="border-btc-orange/25">
        <div className="text-btc-orange">
          <div className="font-bold">1. JSON-RPC (포트 8332)</div>
          <div className="text-muted text-label-xs">
            가장 범용적. 지갑, 블록 탐색기, 이 앱이 사용 중.
          </div>
          <div className="text-tx-blue text-label-xs">
            예: getblock, getrawmempool, estimatesmartfee
          </div>
        </div>
      </DiagramBox>

      <DiagramBox border="border-mempool-green/25">
        <div className="text-mempool-green">
          <div className="font-bold">2. ZMQ (포트 28332/28333)</div>
          <div className="text-muted text-label-xs">
            실시간 이벤트 스트리밍. 폴링 없이 블록/TX 수신.
          </div>
          <div className="text-tx-blue text-label-xs">
            토픽: rawtx, rawblock, hashblock, hashtx
          </div>
        </div>
      </DiagramBox>

      <DiagramBox border="border-block-purple/25">
        <div className="text-block-purple">
          <div className="font-bold">3. REST API (포트 8332/rest/)</div>
          <div className="text-muted text-label-xs">
            인증 불필요 (읽기 전용). 블록 탐색기에 적합.
          </div>
          <div className="text-tx-blue text-label-xs">
            예: /rest/block/, /rest/tx/, /rest/chaininfo
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ 사용처</SectionTitle>
      <InfoRow label="Lightning (LND/CLN)" value="JSON-RPC" />
      <InfoRow label="Block Explorer" value="REST + ZMQ" />
      <InfoRow label="Wallet (Sparrow)" value="JSON-RPC" />
      <InfoRow label="이 앱" value={sourceType === 'server' ? 'RPC + ZMQ' : 'mempool.space API'} color="text-btc-orange" />

      {sourceType === 'server' && (
        <>
          <SectionTitle>▸ 이 앱이 사용 중인 RPC</SectionTitle>
          <div className="text-muted text-label-xs leading-relaxed">
            getblockchaininfo, getnetworkinfo, getpeerinfo,
            getmempoolinfo, getchaintips, estimatesmartfee,
            getblock, getrawmempool, gettxoutsetinfo
          </div>
        </>
      )}
    </div>
  );
}

// ── SPV ──
function SPVTab() {
  return (
    <div>
      <SectionTitle>▸ SPV 클라이언트란?</SectionTitle>
      <DiagramBox border="border-tx-blue/25">
        <div className="text-tx-blue">
          <div>Simplified Payment Verification</div>
          <div className="text-muted text-label-xs">
            전체 블록체인을 다운로드하지 않고 블록 헤더만으로 TX 검증.
            풀노드에 연결하여 필요한 TX만 요청.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ Bloom Filter (BIP 37)</SectionTitle>
      <DiagramBox border="border-error/25">
        <div>
          <div className="text-error">⚠ 프라이버시 취약 (deprecated)</div>
          <div className="text-muted text-label-xs mt-1">
            클라이언트가 관심 있는 주소를 Bloom Filter로 전송 →
            풀노드가 매칭 TX만 반환. 하지만 필터 분석으로
            클라이언트의 주소를 역추적할 수 있음.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ Compact Block Filter (BIP 157/158)</SectionTitle>
      <DiagramBox border="border-success/25">
        <div>
          <div className="text-success">✓ 프라이버시 보호 (권장)</div>
          <div className="text-muted text-label-xs mt-1">
            풀노드가 블록마다 필터를 생성 → 클라이언트가 다운로드 →
            로컬에서 매칭 확인 → 필요한 블록만 요청.
            풀노드는 클라이언트가 어떤 주소에 관심 있는지 모름.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ BIP 157/158 필터 다운로드 플로우</SectionTitle>
      <DiagramBox border="border-success/25">
        <div className="text-success text-label-xs">
          <div>1. 클라이언트 → getcfheaders (필터 헤더 요청)</div>
          <div>2. 풀노드 → cfheaders (헤더 체인 검증용)</div>
          <div>3. 클라이언트 → getcfilters (실제 필터 요청)</div>
          <div>4. 풀노드 → cfilter (GCS 필터 데이터)</div>
          <div className="text-muted mt-1">
            Golomb-coded Set (GCS): 블록 내 모든 scriptPubKey를
            압축 인코딩. 블록당 ~20KB.
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ Bloom vs Compact Block Filter</SectionTitle>
      <DiagramBox border="border-muted-dim">
        <div className="text-label-xs">
          <div className="flex justify-between mb-1">
            <span className="text-muted">방식</span>
            <span className="text-error">Bloom (BIP37)</span>
            <span className="text-success">CBF (BIP157)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">프라이버시</span>
            <span className="text-error">취약</span>
            <span className="text-success">보호</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">필터 생성</span>
            <span className="text-error">클라이언트</span>
            <span className="text-success">풀노드</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">DoS 위험</span>
            <span className="text-error">높음</span>
            <span className="text-success">낮음</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">대역폭</span>
            <span className="text-error">높음 (FP)</span>
            <span className="text-success">낮음</span>
          </div>
        </div>
      </DiagramBox>

      <SectionTitle>▸ 풀노드의 역할</SectionTitle>
      <DiagramBox border="border-btc-orange/25">
        <div className="text-btc-orange">
          <div>NETWORK — 블록/TX 데이터 제공</div>
          <div>WITNESS — SegWit TX 데이터 제공</div>
          <div className="text-success">COMPACT_FILTERS — BIP 157 필터 제공</div>
          <div className="text-muted text-label-xs mt-1">
            SERVICE 플래그로 지원 기능을 광고.
            경량 클라이언트는 필요한 서비스를 가진 풀노드를 선택.
          </div>
        </div>
      </DiagramBox>
    </div>
  );
}

export default function NodeInternalsPanel({ sourceType, nodeInfo, storageInfo, securityInfo, utxoStats, blockHeight, recentBlocks, embedded = false }) {
  const [activeTab, setActiveTab] = useState('p2p');

  const innerContent = (
    <>
      <div className="text-text-primary font-bold text-xs tracking-wide mb-2">
        ▸ NODE INTERNALS
      </div>

      <TabBar active={activeTab} onSelect={setActiveTab} />

      {activeTab === 'p2p' && <P2PTab sourceType={sourceType} nodeInfo={nodeInfo} />}
      {activeTab === 'storage' && <StorageTab sourceType={sourceType} storageInfo={storageInfo} blockHeight={blockHeight} />}
      {activeTab === 'utxo' && <UTXOTab sourceType={sourceType} utxoStats={utxoStats} blockHeight={blockHeight} />}
      {activeTab === 'security' && <SecurityTab sourceType={sourceType} securityInfo={securityInfo} nodeInfo={nodeInfo} />}
      {activeTab === 'time' && <TimeTab sourceType={sourceType} nodeInfo={nodeInfo} />}
      {activeTab === 'rpc' && <RPCTab sourceType={sourceType} />}
      {activeTab === 'spv' && <SPVTab />}
    </>
  );

  if (embedded) {
    return <div className="px-3.5 py-2.5 font-mono text-sm text-text-primary">{innerContent}</div>;
  }

  return (
    <div className="absolute bottom-16 right-4 w-[360px] max-h-[calc(100vh-140px)]
                    overflow-y-auto bg-panel-bg border border-white/10
                    rounded-xl px-3.5 py-2.5 font-mono text-sm text-text-primary
                    backdrop-blur-xl z-[var(--z-hud-float)]
                    max-sm:right-0 max-sm:left-0 max-sm:bottom-0 max-sm:w-full
                    max-sm:max-h-[50vh] max-sm:rounded-b-none max-sm:rounded-t-xl"
         style={{ boxShadow: 'var(--shadow-panel-layered)' }}>
      {innerContent}
    </div>
  );
}
