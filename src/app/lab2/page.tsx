"use client";

import { useState } from "react";
import { Hub } from "./Hub";
import { Workbench } from "./Workbench";
import { Export } from "./Export";

/**
 * D2 무채색 캔버스 — 전체 흐름 시안.
 *
 * 백지에서 다시 잡았다. 기존 토큰 중 액센트(plum)를 쓰지 않고, 강조를 검정 채움과
 * 굵기로만 만든다. 웨이트는 400 / 700 / 900 세 종.
 *
 * IA 도 다시 잡았다 — 카드뉴스 5단계 + 정보전달 4단계가 **각각 3화면**으로 줄었다.
 * 주제와 종류 선택이 한 화면으로, 사진·순서·편집이 한 워크벤치로 합쳐졌다.
 *
 * 방향이 정해지면 이 폴더를 실제 라우트로 옮기고 `/lab` 과 함께 지운다.
 */

const SCREENS = [
  { id: "hub", label: "1 주제", note: "기존 허브 + 주제 입력 단계를 합쳤어요." },
  {
    id: "work",
    label: "2 만들기",
    note: "기존 사진·순서·편집 세 단계를 한 화면으로 합쳤어요. 색이 없는 UI 라 사진과 카드만 색을 가져요.",
  },
  {
    id: "export",
    label: "3 내보내기",
    note: "저장 전에 다섯 장이 한 덩어리로 읽히는지 확인하는 자리로 성격을 바꿨어요.",
  },
] as const;

type ScreenId = (typeof SCREENS)[number]["id"];

export default function Lab2Page() {
  const [current, setCurrent] = useState<ScreenId>("hub");
  const active = SCREENS.find((s) => s.id === current) ?? SCREENS[0];

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="sticky top-0 z-20 flex h-[52px] items-center gap-1 border-b border-hair bg-canvas px-4">
        <span className="mr-3 text-[13px] font-black tracking-tight">D2 무채색 캔버스</span>
        {SCREENS.map((s) => {
          const on = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrent(s.id)}
              aria-pressed={on}
              className={`h-9 rounded-lg px-3 text-sm font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                on ? "bg-ink text-surface" : "text-ink-2 hover:bg-hair-soft hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <span className="ml-auto hidden text-[13px] text-ink-2 lg:block">{active.note}</span>
      </div>

      {current === "hub" && <Hub />}
      {current === "work" && <Workbench />}
      {current === "export" && <Export />}
    </div>
  );
}
