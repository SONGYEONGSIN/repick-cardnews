"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft } from "lucide-react";
import { SegmentedControl } from "@/components/ui";

/**
 * V3 — 파격. 진입 모델 자체를 바꾼다.
 *
 * "무엇을 만들까요?"라고 묻지 않는다. 어차피 답은 둘 중 하나고, 사용자가 진짜로 들고 온
 * 것은 **주제**다. 그래서 키워드 입력 하나를 화면의 축으로 올리고 종류는 그 옆 세그먼트로
 * 내린다 — 허브와 1단계(주제 입력)가 한 화면으로 합쳐진다.
 *
 * 레이아웃은 의도적으로 비대칭이다. 좌측이 행동, 우측이 결과물의 형태. 지금 허브의 빈
 * 공간은 '남은 공간'이지만 여기서는 배치된 여백이다.
 *
 * 대가: 최근 작업물이 하단 스트립으로 밀린다. 그리고 이 화면을 채택하면 각 플로우의
 * 1단계를 들어내야 해서 위저드 구조에도 손이 간다.
 */

const TYPES = [
  { value: "cardnews", label: "카드뉴스" },
  { value: "informationsend", label: "정보전달" },
] as const;

type FlowType = (typeof TYPES)[number]["value"];

export function HubV3() {
  const [type, setType] = useState<FlowType>("cardnews");
  const [keyword, setKeyword] = useState("");
  const router = useRouter();

  const ready = keyword.trim().length > 0;

  function start() {
    if (!ready) return;
    router.push(type === "cardnews" ? "/cardnews" : "/info");
  }

  return (
    <div className="grid min-h-[calc(100vh-52px)] grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="flex flex-col justify-center gap-8 px-8 py-16 lg:px-14">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] font-semibold tracking-tight text-plum">콘티 · 카드 스튜디오</p>
          <h1 className="max-w-[16ch] text-[44px] font-extrabold leading-[1.08] tracking-tight lg:text-[56px]">
            어떤 이야기를 카드로 만들까요?
          </h1>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-end gap-3 border-b-2 border-hair pb-2 transition-colors duration-200 focus-within:border-plum motion-reduce:transition-none">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") start();
              }}
              maxLength={60}
              placeholder="에어컨 전기세"
              aria-label="카드로 만들 주제"
              className="w-full bg-transparent pb-1 text-[28px] font-semibold tracking-tight outline-none placeholder:text-ink-3 lg:text-[32px]"
            />
            <button
              type="button"
              onClick={start}
              disabled={!ready}
              className="mb-1 flex h-11 flex-none items-center gap-2 rounded-lg bg-plum px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-plum-hover active:bg-plum-active disabled:bg-hair disabled:text-ink-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none"
            >
              시작
              <CornerDownLeft size={15} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              options={TYPES}
              value={type}
              onChange={(next) => setType(next)}
              ariaLabel="만들 콘텐츠 종류"
            />
            <p className="text-[13px] text-ink-2">
              {type === "cardnews"
                ? "사진 5~6장으로 넘겨 보는 설득 시퀀스"
                : "사진 1장에 정보를 얹은 인포그래픽 한 장"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-hair pt-5">
          <h2 className="text-[13px] font-semibold">최근 만든 것</h2>
          <p className="text-sm text-ink-2">아직 만든 게 없어요. 주제를 적고 시작하면 여기에 쌓여요.</p>
        </div>
      </div>

      <div className="relative hidden items-center justify-center overflow-hidden border-l border-hair bg-hair-soft lg:flex">
        <ResultShapes type={type} />
      </div>
    </div>
  );
}

/** 우측 패널 — 고른 종류가 어떤 형태로 나오는지 보여 준다. */
function ResultShapes({ type }: { type: FlowType }) {
  if (type === "cardnews") {
    return (
      <div className="flex items-center" aria-hidden="true">
        <div className="h-[268px] w-[212px] -rotate-6 rounded-2xl border border-hair bg-surface" />
        <div className="z-10 -ml-16 h-[300px] w-[240px] rounded-2xl border border-plum bg-surface">
          <div className="flex h-full flex-col justify-end gap-2.5 p-6">
            <div className="h-3 w-4/5 rounded-full bg-plum" />
            <div className="h-3 w-3/5 rounded-full bg-plum-soft" />
          </div>
        </div>
        <div className="-ml-16 h-[268px] w-[212px] rotate-6 rounded-2xl border border-hair bg-surface" />
      </div>
    );
  }
  return (
    <div className="flex h-[320px] w-[256px] flex-col gap-4 rounded-2xl border border-plum bg-surface p-6" aria-hidden="true">
      <div className="h-20 rounded-lg bg-plum-soft" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="h-2 w-2 flex-none rounded-full bg-plum" />
            <div className="h-2.5 flex-1 rounded-full bg-hair" />
          </div>
        ))}
      </div>
      <div className="mt-auto h-2.5 w-2/3 rounded-full bg-plum-soft" />
    </div>
  );
}
