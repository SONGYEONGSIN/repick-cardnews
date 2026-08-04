"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 1080×1350 템플릿을 **주어진 자리에 맞게** 줄이는 배율을 잰다.
 *
 * 카드 미리보기는 저장 결과와 같은 컴포넌트(`CardRenderer`)를 그대로 그린다 — 화면과 파일이
 * 어긋나지 않게 하려는 것이다. 그런데 그 컴포넌트는 1080px 고정이라, 배율을 손으로 박아 두면
 * (`scale-[0.5]`) 자리가 좁아져도 안 줄어 **밖으로 튀어나온다**. 실제로 그랬다(2026-08-04:
 * 음영 419px 자리에 카드 630px). 그래서 자리를 재서 배율을 정한다.
 *
 * 카드뉴스 쪽 `CardCanvas` 는 이 문제가 없다 — 템플릿을 옮겨 그린 반응형 표면이라 CSS 가
 * 알아서 줄인다. 정보전달은 템플릿을 그대로 쓰므로 이 훅이 그 몫을 한다.
 *
 * **콜백 ref 를 쓴다.** `useRef` + `useEffect` 로 짰다가 배율이 0 에 머물렀다 — 카드는 카피를
 * 만든 **뒤에** 붙는데 effect 는 그전에 한 번 돌고 말아, 나중에 생긴 요소에는 관찰자가 걸리지
 * 않았다. 콜백 ref 는 요소가 붙는 그 순간 불린다.
 */
export function useFitScale(width: number, height: number) {
  const [scale, setScale] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback(
    (box: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!box) return;

      const fit = () => {
        const { width: w, height: h } = box.getBoundingClientRect();
        if (w === 0 || h === 0) return;
        // 두 축 중 더 좁은 쪽에 맞춘다 — 비율이 깨지지 않는다.
        setScale(Math.min(w / width, h / height));
      };
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(box);
      observerRef.current = observer;
    },
    [width, height],
  );

  return { ref, scale };
}
