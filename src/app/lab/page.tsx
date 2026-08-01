"use client";

import { useState } from "react";
import { HubW1 } from "./HubW1";
import { HubW2 } from "./HubW2";
import { HubW3 } from "./HubW3";
import { WorkbenchE1 } from "./wb/E1";
import { WorkbenchE2 } from "./wb/E2";
import { WorkbenchE3 } from "./wb/E3";

/**
 * 허브 화면 시안 비교대.
 *
 * 고를 때까지만 존재하는 임시 라우트다 — 방향이 정해지면 이 폴더째 지우고 채택안을
 * `src/app/page.tsx` 로 옮긴다.
 *
 * 세 시안 모두 `repick-design` 의 dash r11·r12 캡처(Palisade·Amberline·Nudge·Cadence)를
 * 실제로 보고 그 문법 위에서 만들었다. 넷이 공유하는 골격 — 좌측 레일 + 상단바 + 헤더
 * 인라인 통계 + 정보가 찬 본문 — 을 셋 다 공유하고, 갈리는 건 **본문의 아키타입**이다.
 */

const VARIANTS = [
  {
    id: "w1",
    label: "W1 콘솔",
    axis: "Palisade — 본문 + 우측 레일",
    caption:
      "r11 승자의 골격이에요. 헤더에 통계를 얹고 본문은 시작 카드 + 만든 것, 우측 레일은 동작 방식 설명. 작업물이 0개여도 화면이 성립하는 게 이 안의 강점이에요.",
  },
  {
    id: "w2",
    label: "W2 워크벤치",
    axis: "Nudge — 좌 선택 · 우 라이브 프리뷰",
    caption:
      "고르면 오른쪽이 결과물의 형태를 즉시 보여 줘요. 고르는 행위가 곧 학습이 됩니다. 이 골격은 허브에서 끝나지 않고 카드 편집 단계와 그대로 이어져요.",
  },
  {
    id: "w3",
    label: "W3 현황판",
    axis: "Cadence — KPI 4장 + 단일 지배 시각화",
    caption:
      "KPI 4장 위에 12주 제작 달력이 화면의 주인공이에요. 꾸준함을 보여 주는 축이라 콘텐츠 도구에 맞지만, 데이터가 쌓여야 성립해요 — 지금 보이는 숫자는 샘플입니다.",
  },
  {
    id: "e1",
    label: "E1 3열",
    axis: "편집 — 좌 레일 · 중앙 프리뷰 · 우 인스펙터",
    caption:
      "편집 도구의 표준 골격이에요. 사진·순서·편집 세 단계가 한 화면으로 합쳐집니다. 인스펙터에 세로 공간이 넉넉해 슬라이더가 답답하지 않은 대신, 프리뷰가 한 장뿐이라 세트 전체의 톤은 못 봐요.",
  },
  {
    id: "e2",
    label: "E2 필름스트립",
    axis: "편집 — 상단 가로 스트립 · 프리뷰 · 인스펙터",
    caption:
      "카드뉴스는 옆으로 넘겨 보는 매체라 순서를 가로 스트립으로 뒀어요. 조작 방향과 결과물의 방향이 같아지고, 안 쓴 사진도 같은 줄 끝에 있어 끌어 넣는 동작이 한 축에서 끝납니다.",
  },
  {
    id: "e3",
    label: "E3 갤러리",
    axis: "편집 — 인스펙터 없이 카드에서 직접",
    caption:
      "인스펙터 패널이 없어요. 카드를 전부 펼쳐 놓고 고른 카드만 그 자리에서 커지며 편집 컨트롤이 열립니다. 다섯 장이 한 덩어리로 읽히는지 항상 보면서 고칠 수 있는 대신, 세밀 조절 폭이 좁아요.",
  },
] as const;

type VariantId = (typeof VARIANTS)[number]["id"];

export default function LabPage() {
  const [current, setCurrent] = useState<VariantId>("w1");
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
        <span className="ml-auto hidden text-[13px] text-ink-2 lg:block">{active.axis}</span>
      </div>

      <p className="border-b border-hair-soft bg-hair-soft px-6 py-3 text-[13px] leading-relaxed text-ink-2">
        {active.caption}
      </p>

      {current === "w1" && <HubW1 />}
      {current === "w2" && <HubW2 />}
      {current === "w3" && <HubW3 />}
      {current === "e1" && <WorkbenchE1 />}
      {current === "e2" && <WorkbenchE2 />}
      {current === "e3" && <WorkbenchE3 />}
    </div>
  );
}
