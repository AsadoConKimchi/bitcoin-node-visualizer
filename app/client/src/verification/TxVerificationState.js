/**
 * TxVerificationState — TX 검증 6단계 상태 머신
 * 서버에서 실제 검증 결과(tx:verified)를 수신하여 표시
 * mempool.space 모드에서는 서버 데이터 없이 기본 성공 표시
 */

// 표준 스크립트 유형 목록
const STANDARD_TYPES = ['P2PKH', 'P2SH', 'P2WPKH', 'P2WSH', 'P2TR', 'OP_RETURN'];

export class TxVerificationState {
  /**
   * @param {object|string} txData - { txid, vin, vout, size, weight, totalOut, scriptTypes, hasWitness } 또는 txid 문자열
   * @param {function} onChange - (state) => void
   */
  constructor(txData, onChange) {
    const data = typeof txData === 'string' ? { txid: txData } : txData;
    this.txData = data;
    this.onChange = onChange;
    this._timers = [];
    this._destroyed = false;
    this._verificationResult = null;
    this._currentStep = -1;
    this._failedReal = false;

    const txid = data.txid || '';
    const short = txid ? txid.slice(0, 8) + '…' + txid.slice(-4) : 'unknown';
    const inOut = `${data.vin ?? '?'}in · ${data.vout ?? '?'}out`;

    const feeRate = data.feeRate ?? (data.fee && data.weight ? Math.round(data.fee / (data.weight / 4)) : null);

    this._state = {
      txid,
      short,
      size: data.size ?? null,
      weight: data.weight ?? null,
      totalOut: data.totalOut ?? null,
      feeRate,
      vin: data.vin ?? null,
      vout: data.vout ?? null,
      startTime: Date.now(),
      steps: [
        { name: '구문 파싱', status: 'waiting', detail: inOut, startTime: null },
        { name: 'IsStandard 검사', status: 'waiting', detail: '대기 중', startTime: null },
        { name: 'UTXO 조회', status: 'waiting', detail: `${data.vin ?? '?'} inputs`, startTime: null },
        { name: '이중 지불 검사', status: 'waiting', detail: '대기 중', startTime: null },
        { name: '서명 검증', status: 'waiting', detail: '대기 중', startTime: null },
        { name: '금액 합산', status: 'waiting', detail: '대기 중', startTime: null },
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
        i === index ? {
          ...s,
          status,
          ...(detail != null ? { detail } : {}),
          ...(status === 'active' && !s.startTime ? { startTime: Date.now() } : {}),
        } : s
      ),
    };
    this.onChange?.(this._state);
  }

  _failAtReal(index, reason) {
    // 실제 검증 실패 처리
    this._failedReal = true;
    this._state = {
      ...this._state,
      steps: this._state.steps.map((s, i) =>
        i === index ? { ...s, status: 'fail', detail: reason } : s
      ),
      done: true,
      failed: true,
      failReason: reason,
    };
    // 이후 타이머 무효화
    this._timers.forEach(clearTimeout);
    this._timers = [];
    this.onChange?.(this._state);
  }

  /**
   * 서버에서 받은 실제 검증 결과 주입
   * @param {object} result - { txid, steps: [{ok, detail}], failed, failStep, failReason }
   */
  injectVerification(result) {
    if (this._destroyed || this._failedReal) return;
    this._verificationResult = result;

    // 이미 지나간 단계의 detail을 실제 데이터로 업데이트
    if (result.steps) {
      const updatedSteps = this._state.steps.map((s, i) => {
        const realStep = result.steps[i];
        if (!realStep) return s;
        if (s.status === 'done' || s.status === 'active') {
          return { ...s, detail: realStep.detail };
        }
        return s;
      });
      this._state = { ...this._state, steps: updatedSteps };
      this.onChange?.(this._state);
    }

    // 실패 단계가 아직 처리 안 됐으면 즉시 실패 처리하지 않고
    // start()의 타이머가 _verificationResult를 확인하여 처리
  }

  start() {
    if (this._destroyed) return;
    const d = this.txData;
    const inOut = `${d.vin ?? '?'}in · ${d.vout ?? '?'}out`;
    const vr = () => this._verificationResult; // 클로저로 최신값 참조

    // Step 0: 구문 파싱
    this._schedule(0, () => this._updateStep(0, 'active'));
    this._schedule(300, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[0];
      this._updateStep(0, 'done', real?.detail ?? (inOut + ' ✓'));
    });

    // Step 1: IsStandard 검사
    this._schedule(500, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[1];
      // 서버 데이터에서 실제 스크립트 유형 표시, 없으면 TX 데이터에서
      const scriptType = d.scriptTypes?.length
        ? d.scriptTypes.join(', ')
        : STANDARD_TYPES[Math.floor(Math.random() * (STANDARD_TYPES.length - 1))];
      this._updateStep(1, 'active', real?.detail ?? `스크립트: ${scriptType}?`);
    });
    this._schedule(800, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[1];
      if (real && !real.ok) {
        this._failAtReal(1, real.detail || '비표준 스크립트');
        return;
      }
      this._updateStep(1, 'done', real?.detail ?? '표준 스크립트 ✓');
    });

    // Step 2: UTXO 조회
    this._schedule(1000, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[2];
      this._updateStep(2, 'active', real?.detail ?? `${d.vin ?? '?'} inputs 조회 중…`);
    });
    this._schedule(1500, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[2];
      if (real && !real.ok) {
        this._failAtReal(2, real.detail || 'UTXO 미존재');
        return;
      }
      this._updateStep(2, 'done', real?.detail ?? `${d.vin ?? '?'} UTXO 확인`);
    });

    // Step 3: 이중 지불 검사
    this._schedule(1700, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[3];
      this._updateStep(3, 'active', real?.detail ?? '멤풀 중복 확인 중…');
    });
    this._schedule(2000, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[3];
      if (real && !real.ok) {
        this._failAtReal(3, real.detail || '이중 지불 감지');
        return;
      }
      this._updateStep(3, 'done', real?.detail ?? '이중 지불 없음 ✓');
    });

    // Step 4: 서명 검증
    this._schedule(2200, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[4];
      this._updateStep(4, 'active', real?.detail ?? 'secp256k1…');
    });
    this._schedule(2900, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[4];
      if (real && !real.ok) {
        this._failAtReal(4, real.detail || '서명 검증 실패');
        return;
      }
      this._updateStep(4, 'done', real?.detail ?? `${d.vin ?? '?'}개 서명 유효`);
    });

    // Step 5: 금액 합산
    this._schedule(3100, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[5];
      this._updateStep(5, 'active', real?.detail ?? '합산 중…');
    });
    this._schedule(3500, () => {
      if (this._failedReal) return;
      const real = vr()?.steps?.[5];
      if (real && !real.ok) {
        this._failAtReal(5, real.detail || '입력 금액 부족');
        return;
      }
      const outStr = real?.detail
        ?? (d.totalOut != null ? `${(d.totalOut / 1e8).toFixed(4)} BTC` : '잔액 OK');
      this._updateStep(5, 'done', outStr);
      this._state = { ...this._state, done: true };
      this.onChange?.(this._state);
    });

    // Fallback — 5초 후에도 완료되지 않았으면 강제 완료
    this._schedule(5000, () => {
      if (this._state.done || this._failedReal) return;
      this._state.steps.forEach((s, i) => {
        if (s.status === 'waiting' || s.status === 'active') {
          this._updateStep(i, 'done', s.detail);
        }
      });
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
