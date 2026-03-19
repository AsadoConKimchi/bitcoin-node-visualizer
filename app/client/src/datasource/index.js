/**
 * DataSource 팩토리
 * 소스 타입에 따라 적합한 어댑터 인스턴스 반환
 */

import { MempoolAdapter } from './MempoolAdapter.js';
import { ServerAdapter } from './ServerAdapter.js';
import { ElectrumAdapter } from './ElectrumAdapter.js';

/**
 * @param {'mempool' | 'server' | 'electrum'} type
 * @param {{ url?: string }} [options]
 * @returns {MempoolAdapter | ServerAdapter | ElectrumAdapter}
 */
export function createDataSource(type, options = {}) {
  if (type === 'server') {
    return new ServerAdapter(options.url);
  }
  if (type === 'electrum') {
    return new ElectrumAdapter(options.url);
  }
  // 기본: mempool.space 공개 API
  return new MempoolAdapter(options.url);
}
