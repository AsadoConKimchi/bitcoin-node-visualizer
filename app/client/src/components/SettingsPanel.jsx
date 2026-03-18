/**
 * SettingsPanel — 데이터 소스 설정 UI
 * Canvas 위에 position: absolute로 표시
 * HUD 스타일 매칭 (검정 배경, 주황 테두리, Courier New)
 */

import React, { useState } from 'react';

export default function SettingsPanel({ sourceType, customNodeUrl, onConnect, onClose }) {
  const [selectedType, setSelectedType] = useState(sourceType);
  const [urlInput, setUrlInput] = useState(customNodeUrl || '');

  function handleConnect() {
    onConnect(selectedType, selectedType === 'electrum' ? urlInput.trim() : '');
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        {/* 헤더 */}
        <div style={styles.header}>
          <span style={styles.title}>DATA SOURCE</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* mempool.space 옵션 */}
        <label style={styles.option}>
          <input
            type="radio"
            name="sourceType"
            value="mempool"
            checked={selectedType === 'mempool'}
            onChange={() => setSelectedType('mempool')}
            style={styles.radio}
          />
          <span style={styles.optionLabel}>mempool.space (Public)</span>
        </label>

        {/* Electrum 옵션 */}
        <label style={styles.option}>
          <input
            type="radio"
            name="sourceType"
            value="electrum"
            checked={selectedType === 'electrum'}
            onChange={() => setSelectedType('electrum')}
            style={styles.radio}
          />
          <span style={styles.optionLabel}>Custom Node (Electrum WSS)</span>
        </label>

        {/* Electrum URL 입력 */}
        {selectedType === 'electrum' && (
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="wss://your-node:50004"
            style={styles.urlInput}
            autoFocus
          />
        )}

        {/* 버튼 행 */}
        <div style={styles.buttonRow}>
          <button style={styles.connectBtn} onClick={handleConnect}>Connect</button>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)',
    zIndex: 10,
  },
  panel: {
    background: 'rgba(0,0,0,0.92)',
    border: '1px solid #f7931a',
    borderRadius: 6,
    padding: '20px 24px',
    width: 340,
    fontFamily: "'Courier New', monospace",
    color: '#f7931a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#f7931a',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 4px',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    cursor: 'pointer',
  },
  radio: {
    accentColor: '#f7931a',
    width: 16,
    height: 16,
    cursor: 'pointer',
  },
  optionLabel: {
    fontSize: 13,
  },
  urlInput: {
    width: '100%',
    background: 'rgba(0,0,0,0.7)',
    border: '1px solid #a16207',
    borderRadius: 4,
    color: '#f7931a',
    fontFamily: "'Courier New', monospace",
    fontSize: 12,
    padding: '8px 10px',
    marginTop: 4,
    marginBottom: 8,
    boxSizing: 'border-box',
    outline: 'none',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  connectBtn: {
    background: '#f7931a',
    border: 'none',
    borderRadius: 4,
    color: '#000',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold',
    fontSize: 12,
    padding: '8px 20px',
    cursor: 'pointer',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid #a16207',
    borderRadius: 4,
    color: '#a16207',
    fontFamily: "'Courier New', monospace",
    fontSize: 12,
    padding: '8px 16px',
    cursor: 'pointer',
  },
};
