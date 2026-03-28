// 비트코인 풀노드 용어 사전
// 교육용: 비전문가가 기술 용어를 이해할 수 있도록

export const GLOSSARY = {
  mempool: {
    term: 'Mempool',
    short: '대기 중인 거래들',
    full: '아직 블록에 포함되지 않은 트랜잭션들이 대기하는 공간입니다. "메모리 풀(Memory Pool)"의 줄임말로, 각 노드가 자체적으로 관리합니다.',
  },
  utxo: {
    term: 'UTXO',
    short: '미사용 출력',
    full: 'Unspent Transaction Output. 아직 사용되지 않은 비트코인 출력입니다. 비트코인 잔고는 개인이 소유한 모든 UTXO의 합으로 계산됩니다.',
  },
  satVb: {
    term: 'sat/vB',
    short: '수수료율 단위',
    full: '가상 바이트(virtual Byte)당 사토시(satoshi) 수. 1 BTC = 1억 satoshi. 이 값이 높을수록 거래가 더 빨리 블록에 포함됩니다.',
  },
  pow: {
    term: 'PoW',
    short: '작업증명',
    full: 'Proof of Work. 채굴자가 엄청난 계산을 수행했다는 증거입니다. 블록 해시가 난이도 타겟보다 작아야 유효한 작업증명으로 인정됩니다.',
  },
  merkle: {
    term: 'Merkle Root',
    short: 'TX 요약 해시',
    full: '블록 내 모든 트랜잭션의 해시를 이진 트리 구조로 결합한 최종 해시값입니다. 단 하나의 TX만 변경되어도 Merkle Root가 완전히 달라집니다.',
  },
  mtp: {
    term: 'MTP',
    short: '중앙 시간',
    full: 'Median Time Past. 최근 11개 블록의 타임스탬프 중앙값입니다. 블록의 타임스탬프가 MTP보다 커야 유효합니다.',
  },
  hash: {
    term: 'Hash',
    short: '고유 지문',
    full: '임의의 데이터를 고정 길이의 고유한 문자열로 변환하는 함수의 결과값입니다. 같은 입력은 항상 같은 해시를 생성하지만, 해시로부터 원본을 복원할 수 없습니다.',
  },
  block: {
    term: 'Block',
    short: '거래 묶음',
    full: '여러 트랜잭션을 하나로 묶은 데이터 단위입니다. 약 10분마다 새 블록이 생성되며, 한 블록에 보통 2,000~5,000개의 거래가 포함됩니다.',
  },
  peer: {
    term: 'Peer',
    short: '연결된 노드',
    full: '네트워크에서 직접 연결된 다른 비트코인 노드입니다. 풀노드는 보통 8~125개의 피어와 연결하여 거래와 블록을 주고받습니다.',
  },
  fee: {
    term: 'Fee',
    short: '거래 수수료',
    full: '트랜잭션 발송자가 채굴자에게 지불하는 수수료입니다. 수수료가 높을수록 채굴자가 우선적으로 블록에 포함시킵니다.',
  },
  coinbase: {
    term: 'Coinbase TX',
    short: '채굴 보상 거래',
    full: '각 블록의 첫 번째 트랜잭션으로, 채굴자가 블록 보상(현재 3.125 BTC)과 수수료를 받는 특별한 거래입니다.',
  },
  weight: {
    term: 'Weight',
    short: '블록 크기 단위',
    full: 'SegWit 이후 도입된 블록 크기 측정 단위(WU). 한 블록의 최대 weight는 4,000,000 WU (약 1MB vsize)입니다.',
  },
  difficulty: {
    term: 'Difficulty',
    short: '채굴 난이도',
    full: '블록을 찾기 위해 필요한 계산량을 나타냅니다. 2,016블록(약 2주)마다 자동 조정되어 평균 10분에 1블록이 생성되도록 합니다.',
  },
  rbf: {
    term: 'RBF',
    short: '수수료 대체',
    full: 'Replace-By-Fee (BIP 125). 아직 블록에 포함되지 않은 거래의 수수료를 높여서 새 버전으로 대체하는 기능입니다.',
  },
  segwit: {
    term: 'SegWit',
    short: '서명 분리',
    full: 'Segregated Witness. 트랜잭션의 서명 데이터를 분리하여 블록 용량을 효율적으로 사용하는 업그레이드입니다 (2017년 활성화).',
  },
  taproot: {
    term: 'Taproot',
    short: '프라이버시 강화',
    full: '2021년 활성화된 업그레이드. Schnorr 서명과 MAST를 도입하여 프라이버시와 스마트 계약 효율성을 높였습니다.',
  },
  p2p: {
    term: 'P2P',
    short: '개인 간 직접 연결',
    full: 'Peer-to-Peer. 중앙 서버 없이 노드들이 서로 직접 연결하여 데이터를 주고받는 네트워크 구조입니다.',
  },
  nonce: {
    term: 'Nonce',
    short: '채굴 시도 횟수',
    full: '채굴자가 유효한 블록 해시를 찾기 위해 변경하는 숫자입니다. 이 값을 바꿔가며 해시를 계산하여 난이도 조건을 만족하는 값을 찾습니다.',
  },
  chainTip: {
    term: 'Chain Tip',
    short: '체인 끝점',
    full: '블록체인의 가장 끝에 있는 블록입니다. 여러 분기(fork)가 있을 수 있으며, 노드는 가장 많은 작업증명이 쌓인 체인을 선택합니다.',
  },
  zmq: {
    term: 'ZMQ',
    short: '실시간 스트리밍',
    full: 'ZeroMQ. Bitcoin Core가 새 블록이나 트랜잭션을 실시간으로 외부 프로그램에 알려주는 메시징 시스템입니다.',
  },
};
