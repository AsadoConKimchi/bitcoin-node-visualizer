/**
 * DataSource 팩토리
 * 소스 타입에 따라 적합한 어댑터 인스턴스 반환
 */

import { MempoolAdapter } from './MempoolAdapter.js';
import { ElectrumAdapter } from './ElectrumAdapter.js';

/**
 * @param {'mempool'|'electrum'} type
 * @param {{ url?: string }} [options]
 * @returns {MempoolAdapter | ElectrumAdapter}
 */
export function createDataSource(type, options = {}) {
  switch (type) {
    case 'electrum':
      return new ElectrumAdapter(options.url);
    case 'mempool':
    default:
      return new MempoolAdapter();
  }
}
