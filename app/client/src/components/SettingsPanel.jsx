import React, { useState } from 'react';

export default function SettingsPanel({ sourceType, serverUrl, onConnect, onClose }) {
  const [selectedType, setSelectedType] = useState(sourceType);
  const [serverInput, setServerInput] = useState(serverUrl || '');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');
  const [testWarning, setTestWarning] = useState('');

  async function handleConnect() {
    if (selectedType === 'mempool') {
      onConnect('mempool', '');
      return;
    }

    const url = serverInput.trim();

    if (!url) {
      onConnect('server', '');
      return;
    }

    setTesting(true);
    setTestError('');
    setTestWarning('');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/health`, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`서버 응답 오류 (${res.status})`);
      const json = await res.json();
      if (!json.ok) throw new Error('서버가 준비되지 않음');

      if (json.rpcConnected === false) {
        setTestWarning('서버 연결됨, Bitcoin Core 미연결 (RPC 오류)');
      }

      onConnect('server', url);
    } catch (err) {
      if (err.name === 'AbortError') {
        setTestError('연결 시간 초과 (5초). URL을 확인하세요.');
      } else {
        setTestError(`연결 실패: ${err.message}`);
      }
    } finally {
      setTesting(false);
    }
  }

  const canConnect = selectedType === 'mempool' || selectedType === 'server';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
      <div className="bg-[rgba(40,40,45,0.9)] border border-white/10 rounded-xl
                     px-6 py-5 w-[380px] text-btc-orange backdrop-blur-[20px]
                     max-sm:w-[calc(100vw-32px)] max-sm:px-4"
           style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-5">
          <span className="text-base font-bold tracking-wider">DATA SOURCE</span>
          <button
            className="bg-transparent border-none text-btc-orange cursor-pointer text-lg px-1 hover:opacity-70"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* mempool.space 옵션 */}
        <label className="flex items-start gap-2.5 mb-3.5 cursor-pointer">
          <input
            type="radio"
            name="sourceType"
            value="mempool"
            checked={selectedType === 'mempool'}
            onChange={() => { setSelectedType('mempool'); setTestError(''); setTestWarning(''); }}
            className="accent-btc-orange w-4 h-4 cursor-pointer mt-0.5 shrink-0"
          />
          <div>
            <div className="text-sm mb-0.5">mempool.space (Demo)</div>
            <div className="text-xs text-[#a16207]">공개 데이터로 시각화. 노드 불필요.</div>
          </div>
        </label>

        {/* My Full Node 옵션 */}
        <label className="flex items-start gap-2.5 mb-3.5 cursor-pointer">
          <input
            type="radio"
            name="sourceType"
            value="server"
            checked={selectedType === 'server'}
            onChange={() => { setSelectedType('server'); setTestError(''); setTestWarning(''); }}
            className="accent-btc-orange w-4 h-4 cursor-pointer mt-0.5 shrink-0"
          />
          <div>
            <div className="text-sm mb-0.5">My Full Node</div>
            <div className="text-xs text-[#a16207]">내 Bitcoin Core에 연결된 서버 필요.</div>
          </div>
        </label>

        {/* 서버 URL 입력 */}
        {selectedType === 'server' && (
          <div className="mt-1">
            {sourceType === 'server' && !serverUrl && (
              <div className="text-xs text-success mb-1.5">✓ Self-hosted (자동 감지)</div>
            )}
            <div className="text-xs text-[#a16207] mb-1">서버 URL (비워두면 same-origin)</div>
            <input
              type="text"
              value={serverInput}
              onChange={(e) => { setServerInput(e.target.value); setTestError(''); setTestWarning(''); }}
              placeholder="http://100.x.x.x:3000"
              className="w-full bg-black/70 border border-[#a16207] rounded
                        text-btc-orange font-mono text-sm px-2.5 py-2 mb-1
                        outline-none focus:border-btc-orange"
              autoFocus
              disabled={testing}
            />
            {testError && (
              <div className="text-xs text-error mt-1 mb-1 leading-snug">{testError}</div>
            )}
            {testWarning && (
              <div className="text-xs text-orange-500 mt-1 mb-1 leading-snug">{testWarning}</div>
            )}
          </div>
        )}

        {/* 버튼 행 */}
        <div className="flex justify-end gap-2.5 mt-5">
          <button
            className={`bg-btc-orange border-none rounded text-black font-mono font-bold
                       text-sm px-5 py-2 ${(!canConnect || testing) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-btc-orange/90'}`}
            onClick={handleConnect}
            disabled={!canConnect || testing}
          >
            {testing ? 'Testing...' : 'Connect'}
          </button>
          <button
            className="bg-transparent border border-[#a16207] rounded text-[#a16207]
                      font-mono text-sm px-4 py-2 cursor-pointer hover:border-btc-orange hover:text-btc-orange"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
