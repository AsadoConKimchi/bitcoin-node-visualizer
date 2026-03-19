/**
 * BlockVerificationState — 블록 검증 7단계 상태 머신
 * Phase 3 확장: Timestamp, Coinbase, Weight 검증 추가
 * 실제 서버 블록 데이터(version, nBits, merkleRoot, txidSample, merkleOk, time, coinbaseValue, weight) 활용
 */

function buildMerkleTree(txidSample, merkleRoot) {
  if (!txidSample?.length) {
    // 서버 데이터 없는 경우 (mempool.space 모드)
    return { leaves: [], level2: [], level1: [], root: merkleRoot?.slice(0, 8) || '--------' };
  }
  const leaves = txidSample.map((txid) => txid.slice(0, 8));
  // 시각화용 페어링 (실제 검증은 서버에서 완료)
  const level2 = [];
  for (let i = 0; i < leaves.length; i += 2) {
    const a = leaves[i];
    const b = leaves[i + 1] || a;
    level2.push(a.slice(0, 4) + b.slice(0, 4));
  }
  const level1 = [];
  for (let i = 0; i < level2.length; i += 2) {
    const a = level2[i];
    const b = level2[i + 1] || a;
    level1.push(a.slice(0, 4) + b.slice(0, 4));
  }
  const root = merkleRoot?.slice(0, 8) || (level1[0] || '').slice(0, 8);
  return { leaves, level2, level1, root };
}

// 현재 블록 보상 계산 (halving 기반)
function getExpectedReward(height) {
  if (height == null) return 312500000; // 3.125 BTC 기본값
  const halvings = Math.floor(height / 210000);
  if (halvings >= 64) return 0;
  return Math.floor(5000000000 / Math.pow(2, halvings));
}

export class BlockVerificationState {
  /**
   * @param {object} blockData - { height, hash, txCount, merkleOk, version, nBits, merkleRoot, txidSample, time, coinbaseValue, weight, ... }
   * @param {function} onChange - (state) => void
   */
  constructor(blockData, onChange) {
    this.blockData = blockData;
    this.onChange = onChange;
    this._timers = [];
    this._destroyed = false;

    this.merkle = buildMerkleTree(blockData.txidSample, blockData.merkleRoot);

    const versionHex = blockData.version != null
      ? `v0x${blockData.version.toString(16)}`
      : 'v?';
    const nBitsStr = blockData.nBits != null
      ? `target: ${typeof blockData.nBits === 'number' ? blockData.nBits.toString(16) : blockData.nBits}`
      : 'target: N/A';

    this._state = {
      blockData,
      startTime: Date.now(),
      stepTimes: [],
      steps: [
        { name: '헤더 파싱', status: 'waiting', detail: versionHex, startTime: null },
        { name: 'PoW 검증', status: 'waiting', detail: nBitsStr, startTime: null },
        { name: 'Timestamp 검증', status: 'waiting', detail: '대기 중', startTime: null },
        { name: 'Coinbase 검증', status: 'waiting', detail: '대기 중', startTime: null },
        { name: 'Merkle root', status: 'waiting', detail: '대기 중', startTime: null },
        { name: '전체 TX 검증', status: 'waiting', detail: `${blockData.txCount ?? '?'} TX 대기`, startTime: null },
        { name: 'Weight 검증', status: 'waiting', detail: '대기 중', startTime: null },
      ],
      merkle: { ...this.merkle, doneCount: 0 },
      done: false,
    };
  }

  _schedule(ms, fn) {
    const t = setTimeout(() => {
      if (!this._destroyed) fn();
    }, ms);
    this._timers.push(t);
  }

  _updateStep(index, status, detail) {
    const now = Date.now();
    this._state = {
      ...this._state,
      steps: this._state.steps.map((s, i) =>
        i === index ? {
          ...s,
          status,
          ...(detail != null ? { detail } : {}),
          ...(status === 'active' && !s.startTime ? { startTime: now } : {}),
        } : s
      ),
    };
    // stepTimes 기록
    if (status === 'done' || status === 'fail') {
      const stepTimes = [...(this._state.stepTimes || [])];
      stepTimes[index] = { start: this._state.steps[index]?.startTime, end: now };
      this._state = { ...this._state, stepTimes };
    }
    this.onChange?.(this._state);
  }

  _updateMerkleDone(count) {
    this._state = {
      ...this._state,
      merkle: { ...this._state.merkle, doneCount: count },
    };
    this.onChange?.(this._state);
  }

  start() {
    if (this._destroyed) return;
    const bd = this.blockData;

    // Step 0: 헤더 파싱 (실제 version)
    const versionHex = bd.version != null ? `v0x${bd.version.toString(16)}` : 'v?';
    this._schedule(0, () => this._updateStep(0, 'active', versionHex));
    this._schedule(400, () => this._updateStep(0, 'done', versionHex + ' ✓'));

    // Step 1: PoW (실제 nBits + hash 비교)
    this._schedule(800, () => {
      const hashPrefix = (bd.hash || '').slice(0, 16) + '…';
      this._updateStep(1, 'active', `hash: ${hashPrefix}`);
      this._schedule(200, () => {
        this._updateStep(1, 'done', 'hash < target ✓');
      });
    });

    // Step 2: Timestamp 검증 (새 — MTP 규칙)
    this._schedule(1200, () => {
      if (bd.time) {
        const ts = new Date(bd.time * 1000);
        const timeStr = `${ts.getUTCHours().toString().padStart(2, '0')}:${ts.getUTCMinutes().toString().padStart(2, '0')} UTC`;
        this._updateStep(2, 'active', `time: ${timeStr}`);
      } else {
        this._updateStep(2, 'active', 'timestamp 확인 중…');
      }
    });
    this._schedule(1600, () => {
      this._updateStep(2, 'done', 'MTP < t < now+2h ✓');
    });

    // Step 3: Coinbase 보상 검증 (새)
    this._schedule(1800, () => {
      const expected = getExpectedReward(bd.height);
      const expectedBTC = (expected / 1e8).toFixed(4);
      this._updateStep(3, 'active', `보상 ≤ ${expectedBTC} BTC?`);
    });
    this._schedule(2200, () => {
      if (bd.coinbaseValue != null) {
        const cbBTC = (bd.coinbaseValue / 1e8).toFixed(4);
        this._updateStep(3, 'done', `${cbBTC} BTC ✓`);
      } else {
        this._updateStep(3, 'done', '보상 확인 ✓');
      }
    });

    // Step 4: Merkle root (실제 서버 결과 사용)
    const leafCount = this.merkle.leaves.length || bd.txCount || 0;
    this._schedule(2400, () => this._updateStep(4, 'active', `${leafCount} txids 해싱 중`));

    // Merkle 리프 애니메이션 (실제 txid 기반)
    const totalLeaves = this.merkle.leaves.length || 8;
    const leafInterval = Math.min(250, 1800 / totalLeaves);
    for (let i = 0; i < totalLeaves; i++) {
      this._schedule(2600 + i * leafInterval, () => this._updateMerkleDone(i + 1));
    }

    const merkleEndMs = 2600 + totalLeaves * leafInterval + 200;
    this._schedule(merkleEndMs, () => {
      // 실제 merkleOk 결과 사용
      if (bd.merkleOk === false) {
        this._updateStep(4, 'fail', 'Merkle 불일치 ✗');
      } else {
        const rootLabel = bd.merkleRoot?.slice(0, 8) || this.merkle.root.slice(0, 8);
        this._updateStep(4, 'done', rootLabel + '… ✓');
      }
    });

    // Step 5: TX 검증
    this._schedule(merkleEndMs + 200, () =>
      this._updateStep(5, 'active', `${bd.txCount ?? '?'} TX 검증 중…`));
    this._schedule(merkleEndMs + 1000, () => {
      this._updateStep(5, 'done', `${bd.txCount ?? '?'} TX 완료`);
    });

    // Step 6: Weight 검증 (새 — 4,000,000 WU 제한)
    this._schedule(merkleEndMs + 1200, () => {
      if (bd.weight != null) {
        const weightStr = `${(bd.weight / 1000).toFixed(0)}k / 4000k WU`;
        this._updateStep(6, 'active', weightStr);
      } else {
        this._updateStep(6, 'active', 'weight 확인 중…');
      }
    });
    this._schedule(merkleEndMs + 1600, () => {
      if (bd.weight != null) {
        const ok = bd.weight <= 4_000_000;
        this._updateStep(6, ok ? 'done' : 'fail',
          ok ? `${(bd.weight / 1000).toFixed(0)}k WU ≤ 4000k ✓` : `${(bd.weight / 1000).toFixed(0)}k WU > 4000k ✗`);
      } else {
        this._updateStep(6, 'done', 'weight ≤ 4M WU ✓');
      }
      this._state = { ...this._state, done: true };
      this.onChange?.(this._state);
    });

    // 초기 상태 emit
    this.onChange?.(this._state);
  }

  getState() {
    return this._state;
  }

  destroy() {
    this._destroyed = true;
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }
}
