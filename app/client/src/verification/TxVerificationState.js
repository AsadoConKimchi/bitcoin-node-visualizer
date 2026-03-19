/**
 * TxVerificationState — TX 검증 6단계 상태 머신
 * Phase 3 확장: IsStandard Check, Double Spend Check 추가
 * Phase 4 확장: failChance 옵션 (교육용 랜덤 실패 시뮬레이션)
 * 실제 TX 데이터(vin, vout, size, weight, totalOut) 활용
 */

// 표준 스크립트 유형 목록
const STANDARD_TYPES = ['P2PKH', 'P2SH', 'P2WPKH', 'P2WSH', 'P2TR', 'OP_RETURN'];

// 실패 사유 목록 (교육용)
const FAIL_REASONS = [
  '이중 지불 감지',
  '서명 검증 실패',
  '비표준 스크립트',
  'UTXO 미존재',
];

// 실패 가능 단계 (2=UTXO, 3=이중지불, 4=서명)
const FAIL_STEPS = [2, 3, 4];

export class TxVerificationState {
  /**
   * @param {object|string} txData - { txid, vin, vout, size, weight, totalOut } 또는 txid 문자열
   * @param {function} onChange - (state) => void
   * @param {object} [options] - { failChance: 0.03 }
   */
  constructor(txData, onChange, options = {}) {
    // 문자열로 전달된 경우 래핑
    const data = typeof txData === 'string' ? { txid: txData } : txData;
    this.txData = data;
    this.onChange = onChange;
    this._timers = [];
    this._destroyed = false;

    const failChance = options.failChance ?? 0;
    this._willFail = Math.random() < failChance;
    this._failStep = this._willFail ? FAIL_STEPS[Math.floor(Math.random() * FAIL_STEPS.length)] : -1;
    this._failReason = this._willFail ? FAIL_REASONS[Math.floor(Math.random() * FAIL_REASONS.length)] : null;

    const txid = data.txid || '';
    const short = txid ? txid.slice(0, 8) + '…' + txid.slice(-4) : 'unknown';
    const inOut = `${data.vin ?? '?'}in · ${data.vout ?? '?'}out`;

    this._state = {
      txid,
      short,
      size: data.size ?? null,
      weight: data.weight ?? null,
      totalOut: data.totalOut ?? null,
      steps: [
        { name: '구문 파싱', status: 'waiting', detail: inOut },
        { name: 'IsStandard 검사', status: 'waiting', detail: '대기 중' },
        { name: 'UTXO 조회', status: 'waiting', detail: `${data.vin ?? '?'} inputs` },
        { name: '이중 지불 검사', status: 'waiting', detail: '대기 중' },
        { name: '서명 검증', status: 'waiting', detail: '대기 중' },
        { name: '금액 합산', status: 'waiting', detail: '대기 중' },
      ],
      done: false,
      failed: false,
      failReason: null,
    };
  }

  _schedule(ms, fn) {
    const t = setTimeout(() => {
      if (!this._destroyed) fn();
    }, ms);
    this._timers.push(t);
  }

  _updateStep(index, status, detail) {
    this._state = {
      ...this._state,
      steps: this._state.steps.map((s, i) =>
        i === index ? { ...s, status, ...(detail != null ? { detail } : {}) } : s
      ),
    };
    this.onChange?.(this._state);
  }

  _failAt(index) {
    this._state = {
      ...this._state,
      steps: this._state.steps.map((s, i) =>
        i === index ? { ...s, status: 'fail', detail: this._failReason } : s
      ),
      done: true,
      failed: true,
      failReason: this._failReason,
    };
    this.onChange?.(this._state);
  }

  start() {
    if (this._destroyed) return;
    const d = this.txData;
    const inOut = `${d.vin ?? '?'}in · ${d.vout ?? '?'}out`;

    // Step 0: 구문 파싱 (실제 vin/vout)
    this._schedule(0, () => this._updateStep(0, 'active'));
    this._schedule(300, () => this._updateStep(0, 'done', inOut + ' ✓'));

    // Step 1: IsStandard 검사
    this._schedule(500, () => {
      const scriptType = STANDARD_TYPES[Math.floor(Math.random() * (STANDARD_TYPES.length - 1))];
      this._updateStep(1, 'active', `스크립트: ${scriptType}?`);
    });
    this._schedule(800, () => {
      this._updateStep(1, 'done', '표준 스크립트 ✓');
    });

    // Step 2: UTXO 조회
    this._schedule(1000, () => {
      if (this._failStep === 2) {
        this._updateStep(2, 'active', `${d.vin ?? '?'} inputs 조회 중…`);
      } else {
        this._updateStep(2, 'active', `${d.vin ?? '?'} inputs 조회 중…`);
      }
    });
    this._schedule(1500, () => {
      if (this._failStep === 2) {
        this._failAt(2);
        return;
      }
      this._updateStep(2, 'done', `${d.vin ?? '?'} UTXO 확인`);
    });

    // Step 3: 이중 지불 검사
    this._schedule(1700, () => {
      if (this._willFail && this._failStep <= 2) return;
      this._updateStep(3, 'active', '멤풀 중복 확인 중…');
    });
    this._schedule(2000, () => {
      if (this._willFail && this._failStep <= 2) return;
      if (this._failStep === 3) {
        this._failAt(3);
        return;
      }
      this._updateStep(3, 'done', '이중 지불 없음 ✓');
    });

    // Step 4: 서명 검증
    this._schedule(2200, () => {
      if (this._willFail && this._failStep <= 3) return;
      this._updateStep(4, 'active', 'secp256k1…');
    });
    this._schedule(2900, () => {
      if (this._willFail && this._failStep <= 3) return;
      if (this._failStep === 4) {
        this._failAt(4);
        return;
      }
      this._updateStep(4, 'done', `${d.vin ?? '?'}개 서명 유효`);
    });

    // Step 5: 금액 합산 (실제 totalOut)
    this._schedule(3100, () => {
      if (this._willFail) return;
      this._updateStep(5, 'active', '합산 중…');
    });
    this._schedule(3500, () => {
      if (this._willFail) return;
      const outStr = d.totalOut != null
        ? `${(d.totalOut / 1e8).toFixed(4)} BTC`
        : '잔액 OK';
      this._updateStep(5, 'done', outStr);
      this._state = { ...this._state, done: true };
      this.onChange?.(this._state);
    });

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
