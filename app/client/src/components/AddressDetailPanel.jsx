import React, { useEffect, useState } from 'react';

const REST_BASE = 'https://mempool.space/api';

function Row({ label, value, mono, highlight }) {
  return (
    <div className="flex justify-between py-1 border-b border-dark-surface gap-3">
      <span className="text-muted shrink-0 text-sm">{label}</span>
      <span className={`text-right text-sm ${highlight ? 'text-btc-orange' : 'text-text-primary'}
                       ${mono ? 'break-all text-xs' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

// 주소 타입 판별
function addressType(addr) {
  if (!addr) return '?';
  if (addr.startsWith('bc1p')) return 'P2TR (Taproot)';
  if (addr.startsWith('bc1q') && addr.length === 42) return 'P2WPKH (Native SegWit)';
  if (addr.startsWith('bc1q') && addr.length === 62) return 'P2WSH (Native SegWit)';
  if (addr.startsWith('3')) return 'P2SH (Wrapped SegWit)';
  if (addr.startsWith('1')) return 'P2PKH (Legacy)';
  return '?';
}

export default function AddressDetailPanel({ address, onClose, onTxClick }) {
  const [info, setInfo] = useState(null);
  const [txs, setTxs] = useState([]);
  const [utxos, setUtxos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${REST_BASE}/address/${address}`).then(r => r.ok ? r.json() : null),
      fetch(`${REST_BASE}/address/${address}/txs`).then(r => r.ok ? r.json() : null),
      fetch(`${REST_BASE}/address/${address}/utxo`).then(r => r.ok ? r.json() : null),
    ])
      .then(([addrInfo, addrTxs, addrUtxos]) => {
        if (!addrInfo) throw new Error('주소를 찾을 수 없습니다');
        setInfo(addrInfo);
        setTxs(addrTxs?.slice(0, 25) || []);
        setUtxos(addrUtxos || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [address]);

  // 잔액 계산
  const funded = info?.chain_stats?.funded_txo_sum || 0;
  const spent = info?.chain_stats?.spent_txo_sum || 0;
  const mempoolFunded = info?.mempool_stats?.funded_txo_sum || 0;
  const mempoolSpent = info?.mempool_stats?.spent_txo_sum || 0;
  const balanceSats = (funded - spent) + (mempoolFunded - mempoolSpent);
  const totalTxCount = (info?.chain_stats?.tx_count || 0) + (info?.mempool_stats?.tx_count || 0);

  const tabs = [
    { key: 'info', label: '정보' },
    { key: 'txs', label: `TX (${totalTxCount})` },
    { key: 'utxo', label: `UTXO (${utxos.length})` },
  ];

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[19]" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[420px] max-h-[75vh] overflow-y-auto bg-panel-bg-solid
                      border border-btc-orange rounded-lg px-5 py-4
                      font-mono text-sm text-text-primary backdrop-blur-md z-20
                      shadow-[0_0_40px_rgba(247,147,26,0.2)]
                      max-sm:w-[calc(100vw-24px)] max-sm:max-h-[80vh]">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-btc-orange/25">
          <div className="min-w-0">
            <div className="text-btc-orange font-bold text-base">주소 상세</div>
            <div className="text-xs text-muted mt-0.5 truncate max-w-[320px]">{address}</div>
            <div className="text-[10px] text-text-dim mt-0.5">{addressType(address)}</div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border border-muted-dim rounded text-muted
                      cursor-pointer px-2 py-0.5 font-mono text-sm hover:text-text-primary shrink-0 ml-2"
          >
            ✕
          </button>
        </div>

        {loading && (
          <div className="text-text-dim text-center py-4">mempool.space에서 로드 중…</div>
        )}

        {error && (
          <div className="text-error text-center py-2 text-xs">로드 실패: {error}</div>
        )}

        {info && (
          <>
            {/* 잔액 표시 */}
            <div className="bg-dark-surface border border-dark-border rounded-lg px-4 py-3 mb-3 text-center">
              <div className="text-muted text-xs mb-1">총 잔액</div>
              <div className="text-btc-orange text-lg font-bold">
                {(balanceSats / 1e8).toFixed(8)} BTC
              </div>
              <div className="text-text-dim text-xs mt-0.5">
                {balanceSats.toLocaleString()} sats
              </div>
            </div>

            {/* 탭 바 */}
            <div className="flex gap-1 mb-3">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`font-mono text-xs px-2.5 py-1 rounded cursor-pointer border transition-colors
                             ${activeTab === tab.key
                               ? 'bg-btc-orange text-black border-btc-orange'
                               : 'bg-transparent text-btc-orange/60 border-btc-orange/25 hover:border-btc-orange/50'
                             }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 정보 탭 */}
            {activeTab === 'info' && (
              <>
                <Row label="주소 타입" value={addressType(address)} />
                <Row label="잔액" value={`${(balanceSats / 1e8).toFixed(8)} BTC`} highlight />
                <Row label="총 TX 수" value={totalTxCount.toLocaleString()} />
                <Row label="수신 TX" value={info.chain_stats?.tx_count?.toString()} />
                <Row label="수신 합계" value={`${(funded / 1e8).toFixed(8)} BTC`} />
                <Row label="송신 합계" value={`${(spent / 1e8).toFixed(8)} BTC`} />
                {info.mempool_stats?.tx_count > 0 && (
                  <Row label="미확인 TX" value={info.mempool_stats.tx_count.toString()} />
                )}
              </>
            )}

            {/* TX 히스토리 탭 */}
            {activeTab === 'txs' && (
              <div className="space-y-0.5">
                {txs.length === 0 && (
                  <div className="text-text-dim text-xs text-center py-3">TX 없음</div>
                )}
                {txs.map((tx, i) => {
                  const isConfirmed = tx.status?.confirmed;
                  return (
                    <div
                      key={tx.txid}
                      onClick={() => onTxClick?.({ txid: tx.txid, data: {} })}
                      className="text-xs text-text-secondary py-1 px-1.5 border-b border-dark-surface
                                cursor-pointer hover:bg-btc-orange/5 rounded"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] ${isConfirmed ? 'text-success' : 'text-warning'}`}>
                          {isConfirmed ? '✓' : '◌'}
                        </span>
                        <span className="font-mono truncate">{tx.txid.slice(0, 16)}…</span>
                      </div>
                      {isConfirmed && tx.status.block_height && (
                        <div className="text-[9px] text-muted ml-4">
                          블록 #{tx.status.block_height.toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* UTXO 탭 */}
            {activeTab === 'utxo' && (
              <div className="space-y-0.5">
                {utxos.length === 0 && (
                  <div className="text-text-dim text-xs text-center py-3">UTXO 없음</div>
                )}
                {utxos.map((utxo, i) => (
                  <div
                    key={`${utxo.txid}:${utxo.vout}`}
                    onClick={() => onTxClick?.({ txid: utxo.txid, data: {} })}
                    className="text-xs text-text-secondary py-1 px-1.5 border-b border-dark-surface
                              cursor-pointer hover:bg-btc-orange/5 rounded"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] truncate max-w-[200px]">
                        {utxo.txid.slice(0, 12)}…:{utxo.vout}
                      </span>
                      <span className="text-btc-orange shrink-0">
                        {(utxo.value / 1e8).toFixed(8)} BTC
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px] text-muted mt-0.5">
                      <span>{utxo.status?.confirmed ? `확인됨 (블록 #${utxo.status.block_height?.toLocaleString()})` : '미확인'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* mempool.space 링크 */}
        <div className="mt-3 text-center">
          <a
            href={`https://mempool.space/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-btc-orange text-xs no-underline border border-btc-orange/25
                      px-3 py-1 rounded hover:bg-btc-orange/10"
          >
            mempool.space에서 보기 ↗
          </a>
        </div>
      </div>
    </>
  );
}
