import React, { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'bnv_onboarded';

const STEPS = [
  {
    title: '비트코인 네트워크의 3D 지도',
    description: '세계 각지에 분포된 비트코인 풀노드를 실시간으로 시각화합니다. 각 점은 하나의 풀노드입니다.',
    targetSelector: null, // 전체 지구본
    position: 'center',
  },
  {
    title: '주황색 점 = 당신의 노드',
    description: '지구본의 주황색 빛나는 점이 당신의 노드 위치입니다. 초록색은 연결된 피어, 파란색은 알려진 다른 노드입니다.',
    targetSelector: null,
    position: 'center',
  },
  {
    title: '새 블록 도착 → 검증 과정',
    description: '새 블록이 도착하면 우측에 7단계 검증 과정이 애니메이션으로 표시됩니다. 헤더 파싱, PoW 확인, 머클 트리 검증 등.',
    targetSelector: null,
    position: 'right',
  },
  {
    title: '멤풀 대기 거래 확인',
    description: '"TX 흐름" 뷰에서 실시간으로 수신되는 트랜잭션과 검증 과정을 볼 수 있습니다. 검증 완료된 TX는 하단 멤풀 풀에 표시됩니다.',
    targetSelector: null,
    position: 'left',
  },
  {
    title: '상단 메뉴로 뷰 전환',
    description: 'P2P, TX 흐름, 블록 검증, Internals — 4가지 뷰를 전환하며 풀노드의 다양한 기능을 탐색하세요.',
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
          <p className="text-text-secondary text-sm leading-relaxed mb-4">
            {step.description}
          </p>

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
