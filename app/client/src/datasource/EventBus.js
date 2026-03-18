/**
 * 재사용 가능한 이벤트 버스
 * ws.js의 listeners Map 로직을 클래스로 추출
 */
export class EventBus {
  constructor() {
    this._listeners = new Map(); // type → Set<callback>
  }

  /**
   * 이벤트 구독
   * @param {string} type
   * @param {Function} cb
   * @returns {Function} 구독 해제 함수
   */
  subscribe(type, cb) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(cb);
    return () => this._listeners.get(type)?.delete(cb);
  }

  /**
   * 이벤트 발행
   * @param {string} type
   * @param {*} data
   */
  emit(type, data) {
    const set = this._listeners.get(type);
    if (set) set.forEach((cb) => cb(data));
  }

  /**
   * 모든 구독 해제
   */
  clear() {
    this._listeners.clear();
  }
}
