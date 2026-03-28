import React, { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'bnv_onboarded';

const STEPS = [
  // ── 인트로 3슬라이드: "비트코인 풀노드란?" ──
  {
    title: '비트코인 풀노드란?',
    description: null,
    customContent: true,
    customId: 'intro1',
    targetSelector: null,
    position: 'center',
  },
  {
    title: '풀노드는 무엇을 하나요?',
    description: null,
    customContent: true,
    customId: 'intro2',
    targetSelector: null,
    position: 'center',
  },
  {
    title: '이 앱의 구성',
    description: null,
    customContent: true,
    customId: 'intro3',
    targetSelector: null,
    position: 'center',
  },
  // ── 기존 사용법 가이드 ──
  {
    title: '3D 지구본',
    description: '세계 각지의 비트코인 풀노드를 실시간으로 시각화합니다. 주황색 = 당신의 노드, 초록색 = 피어, 파란색 = 알려진 노드.',
    targetSelector: null,
    position: 'center',
  },
  {
    title: '우측 관제센터',
    description: '5개 탭을 순서대로 탐색하면 풀노드의 전체 작업 흐름을 이해할 수 있습니다. ①연결 → ②TX검증 → ③블록 → ④체인 → ⑤깊이',
    targetSelector: null,
    position: 'right',
  },
  {
    title: '하단 멤풀',
    description: '블록에 포함되기를 기다리는 거래들이 실시간으로 표시됩니다. 색상은 수수료율을 나타냅니다.',
    targetSelector: null,
    position: 'bottom',
  },
  {
    title: '상단 지구본 모드',
    description: 'P2P 연결, 검증, 내부 탐색 — 3가지 모드로 지구본 시각화를 전환합니다.',
    targetSelector: null,
    position: 'top',
  },
];

export default function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(-1);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const onboarded = localStorage.getItem(LS_KEY);
    if (!onboarded) {
      // 2초 후 시작 (지구본 로딩 대기)
      const t = setTimeout(() => {
        setCurrentStep(0);
        setDismissed(false);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep >= STEPS.length - 1) {
      localStorage.setItem(LS_KEY, '1');
      setDismissed(true);
      return;
    }
    setCurrentStep(s => s + 1);
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(LS_KEY, '1');
    setDismissed(true);
  }, []);

  if (dismissed || currentStep < 0) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* 반투명 오버레이 */}
      <div className="absolute inset-0 bg-black/70" onClick={handleSkip} />

      {/* 말풍선 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      max-w-[340px] w-[calc(100vw-48px)]">
        <div className="tooltip-bubble">
          {/* 단계 표시 */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-btc-orange text-xs font-bold tracking-wider">
              {currentStep + 1} / {STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-muted text-xs cursor-pointer bg-transparent border-none hover:text-text-primary"
            >
              건너뛰기
            </button>
          </div>

          {/* 진행 바 */}
          <div className="h-0.5 bg-dark-border rounded mb-3">
            <div
              className="h-full bg-btc-orange rounded transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* 제목 */}
          <h3 className="text-btc-orange text-base font-bold mb-2">
            {step.title}
          </h3>

          {/* 설명 */}
          {step.customId === 'intro1' ? (
            <div className="mb-4 space-y-2 text-sm text-text-secondary leading-relaxed">
              <p>비트코인 풀노드는 <span className="text-btc-orange font-medium">모든 거래와 블록을 직접 검증</span>하는 소프트웨어입니다.</p>
              <p>은행이나 제3자에 의존하지 않고, 비트코인 네트워크의 규칙이 지켜지고 있는지 스스로 확인합니다.</p>
              <p className="text-text-dim text-xs">전 세계 약 50,000개의 풀노드가 24시간 운영되고 있습니다.</p>
            </div>
          ) : step.customId === 'intro2' ? (
            <div className="mb-4 space-y-2.5">
              {[
                { icon: '🌐', color: 'text-tx-blue', title: '① 다른 노드와 연결', desc: 'P2P 네트워크로 전 세계 노드와 직접 소통' },
                { icon: '🔍', color: 'text-mempool-green', title: '② 거래를 수신하고 검증', desc: '6단계 검증으로 위조 거래를 걸러냄' },
                { icon: '⛏', color: 'text-btc-orange', title: '③ 새 블록을 검증', desc: '7가지 규칙을 확인하여 유효한 블록만 수용' },
                { icon: '💾', color: 'text-block-purple', title: '④ 블록체인 전체를 저장', desc: '2009년부터의 모든 거래 기록을 보관' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={`text-base ${item.color}`}>{item.icon}</span>
                  <div>
                    <div className="text-text-primary text-sm font-medium">{item.title}</div>
                    <div className="text-text-secondary text-xs">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : step.customId === 'intro3' ? (
            <div className="mb-4 space-y-2.5">
              {[
                { icon: '🌍', title: '왼쪽: 3D 지구본', desc: '노드 간 연결과 데이터 전파를 실시간 시각화' },
                { icon: '📊', title: '오른쪽: 관제센터', desc: '5개 탭을 순서대로 탐색하면 풀노드의 전체 작업을 이해할 수 있습니다' },
                { icon: '📦', title: '하단: 멤풀', desc: '블록에 포함되기를 기다리는 거래들이 쌓입니다' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <div className="text-text-primary text-sm font-medium">{item.title}</div>
                    <div className="text-text-secondary text-xs">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : step.description ? (
            <p className="text-text-secondary text-sm leading-relaxed mb-4">
              {step.description}
            </p>
          ) : null}

          {/* 버튼 */}
          <div className="flex justify-end gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(s => s - 1)}
                className="text-muted text-xs px-3 py-1.5 rounded cursor-pointer
                          bg-transparent border border-muted-dim hover:border-muted"
              >
                이전
              </button>
            )}
            <button
              onClick={handleNext}
              className="bg-btc-orange text-black text-xs font-bold px-4 py-1.5
                        rounded cursor-pointer border-none hover:bg-btc-orange/90"
            >
              {isLast ? '시작하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
