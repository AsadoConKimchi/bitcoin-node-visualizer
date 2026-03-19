import React from 'react';
import BlockVerifyPanel from './BlockVerifyPanel.jsx';

/**
 * VerificationOverlay — 블록 검증 패널만 렌더링
 * TX 검증은 TxStreamPanel의 호버 툴팁으로 이동
 */
export default function VerificationOverlay({ blockVerifyState, showBlock }) {
  return (
    <>
      {showBlock && blockVerifyState && (
        <BlockVerifyPanel verifyState={blockVerifyState} />
      )}
    </>
  );
}
