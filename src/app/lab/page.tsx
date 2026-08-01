"use client";

import { useState } from "react";
import { HubV1 } from "./HubV1";
import { HubV2 } from "./HubV2";
import { HubV3 } from "./HubV3";

/**
 * 허브 화면 시안 비교대.
 *
 * 고를 때까지만 존재하는 임시 라우트다 — 방향이 정해지면 이 폴더째 지우고 채택안을
 * `src/app/page.tsx` 로 옮긴다.
 *
 * 세 시안은 색이 아니라 **무엇이 화면의 주인공인지**로 갈린다. 색·타이포·컴포넌트는
 * 같은 토큰을 쓰므로, 눈에 보이는 차이는 전부 구성에서 온다.
 */

const VARIANTS = [
  {
    id: "v1",
    label: "V1 정석",
    axis: "현행 골격 유지",
    caption:
      "지금 구조 그대로, 결함만 걷어냈어요. 아래쪽 죽은 공간을 없애고, 카드의 라벨-값 두 줄을 단계 점으로 줄이고, 대문자 소제목을 평범한 제목과 헤어라인으로 바꿨어요.",
  },
  {
    id: "v2",
    label: "V2 정제",
    axis: "위계 역전",
    caption:
      "히어로 문구를 없애고 작업물 서랍을 화면의 주인공으로 삼았어요. 만들기는 상단 액션으로 내려갑니다. 매일 여는 도구는 '새로 만들기'보다 '지난번 그거'를 더 자주 찾는다는 전제예요.",
  },
  {
    id: "v3",
    label: "V3 파격",
    axis: "진입 모델 변경",
    caption:
      "'무엇을 만들까요?'를 묻지 않아요. 어차피 답은 둘 중 하나고 사용자가 들고 온 건 주제니까요. 키워드 입력이 화면의 축이 되고 종류는 옆 세그먼트로 내려가, 허브와 1단계가 한 화면이 됩니다.",
  },
] as const;

type VariantId = (typeof VARIANTS)[number]["id"];

export default function LabPage() {
  const [current, setCurrent] = useState<VariantId>("v1");
  const active = VARIANTS.find((v) => v.id === current) ?? VARIANTS[0];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="sticky top-0 z-20 flex h-[52px] items-center gap-1 border-b border-hair bg-surface px-4">
        <span className="mr-3 text-[13px] font-extrabold tracking-tight">시안 비교</span>
        {VARIANTS.map((v) => {
          const on = v.id === current;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setCurrent(v.id)}
              aria-pressed={on}
              className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                on ? "bg-plum text-white" : "text-ink-2 hover:bg-hair-soft hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          );
        })}
        <span className="ml-auto hidden text-[13px] text-ink-2 md:block">{active.axis}</span>
      </div>

      <p className="border-b border-hair-soft bg-hair-soft px-6 py-3 text-[13px] leading-relaxed text-ink-2">
        {active.caption}
      </p>

      {current === "v1" && <HubV1 />}
      {current === "v2" && <HubV2 />}
      {current === "v3" && <HubV3 />}
    </div>
  );
}
