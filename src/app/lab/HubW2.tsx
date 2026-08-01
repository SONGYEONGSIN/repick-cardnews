"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Images, LayoutTemplate, Plus } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { PageHead, Shell, StatStrip } from "./Shell";

/**
 * W2 — 워크벤치형. Nudge(r12 c)의 split workbench 를 옮겼다.
 *
 * Nudge 는 좌측에 질문 레일, 우측에 "응답자에게 이렇게 보인다"는 라이브 프리뷰를 둔다.
 * 콘티에 그대로 대응된다 — 좌측에서 만들 종류를 고르면 우측이 그 결과물의 형태를 즉시
 * 보여 준다. 고르는 행위 자체가 학습이 되고, 빈 화면이 생길 자리가 없다.
 *
 * 이 구조는 허브에서 끝나지 않는다. 카드 스튜디오의 편집 단계가 정확히 같은 골격이라
 * 이걸 채택하면 앱 전체가 하나의 문법을 쓰게 된다.
 */

const FLOWS = [
  {
    id: "cardnews",
    href: "/cardnews",
    title: "카드뉴스",
    tagline: "사진 5~6장으로 넘겨 보는 설득 시퀀스",
    steps: ["주제", "사진", "순서", "편집", "내보내기"],
    outputPath: "cardnews/",
    roles: ["후크", "문제", "근거", "해법", "행동"],
  },
  {
    id: "info",
    href: "/info",
    title: "정보전달",
    tagline: "사진 1장에 정보를 얹은 인포그래픽 한 장",
    steps: ["주제", "사진", "편집", "내보내기"],
    outputPath: "informationsend/",
    roles: ["제목", "항목 3~4개", "팁"],
  },
] as const;

type FlowId = (typeof FLOWS)[number]["id"];

function FlowRow({
  flow,
  selected,
  onSelect,
}: {
  flow: (typeof FLOWS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
          selected ? "border-plum bg-plum-soft" : "border-hair bg-surface hover:border-ink-3"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${
              selected ? "bg-plum text-white" : "bg-hair-soft text-ink-2"
            }`}
          >
            {flow.id === "cardnews" ? (
              <Images size={16} aria-hidden="true" />
            ) : (
              <LayoutTemplate size={16} aria-hidden="true" />
            )}
          </span>
          <span className="text-[15px] font-semibold tracking-tight">{flow.title}</span>
          <span className="ml-auto text-[13px] tabular-nums text-ink-2">{flow.steps.length}단계</span>
        </span>
        <span className="text-sm leading-relaxed text-ink-2">{flow.tagline}</span>
      </button>

      {selected && (
        <div className="mt-2 flex flex-col gap-3 rounded-xl border border-hair bg-surface p-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold text-ink-2">단계</p>
            <ol className="flex flex-wrap items-center gap-1.5">
              {flow.steps.map((s, i) => (
                <li key={s} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight size={12} className="text-ink-3" aria-hidden="true" />}
                  <span className="rounded bg-hair-soft px-2 py-1 text-[13px] text-ink-2">{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-[13px] text-ink-2">
            저장 위치 <span className="font-semibold text-ink">{flow.outputPath}</span>
          </p>
          <Link
            href={flow.href}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg bg-plum text-sm font-semibold text-white transition-colors duration-200 hover:bg-plum-hover active:bg-plum-active ${FOCUS_RING} motion-reduce:transition-none`}
          >
            <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
            {flow.title} 시작
          </Link>
        </div>
      )}
    </li>
  );
}

/** 우측 라이브 프리뷰 — 고른 종류의 결과물이 어떤 형태인지 실제 비율로 보여 준다. */
function LivePreview({ flow }: { flow: (typeof FLOWS)[number] }) {
  const isCardnews = flow.id === "cardnews";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hair bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold tracking-tight">이렇게 나와요</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">
          {isCardnews
            ? "카드 한 장마다 역할이 정해져 있어요. 첫 장은 후크, 마지막은 행동 유도예요."
            : "한 장 안에 제목과 항목이 들어가요. 사진은 위쪽 밴드에 놓여요."}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-lg bg-hair-soft py-8">
        {isCardnews ? (
          <div className="flex items-center" aria-hidden="true">
            <div className="h-[180px] w-[144px] -rotate-6 rounded-xl border border-hair bg-surface" />
            <div className="z-10 -ml-10 flex h-[200px] w-[160px] flex-col justify-end gap-2 rounded-xl border border-plum bg-surface p-4">
              <div className="h-2.5 w-4/5 rounded-full bg-plum" />
              <div className="h-2.5 w-3/5 rounded-full bg-plum-soft" />
            </div>
            <div className="-ml-10 h-[180px] w-[144px] rotate-6 rounded-xl border border-hair bg-surface" />
          </div>
        ) : (
          <div className="flex h-[200px] w-[160px] flex-col gap-3 rounded-xl border border-plum bg-surface p-4" aria-hidden="true">
            <div className="h-12 rounded bg-plum-soft" />
            <div className="flex flex-col gap-2">
              <div className="h-2 w-full rounded-full bg-hair" />
              <div className="h-2 w-5/6 rounded-full bg-hair" />
              <div className="h-2 w-4/6 rounded-full bg-hair" />
            </div>
            <div className="mt-auto h-2 w-1/2 rounded-full bg-plum-soft" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold text-ink-2">구성</p>
        <ul className="flex flex-wrap gap-1.5">
          {flow.roles.map((r) => (
            <li key={r} className="rounded bg-hair-soft px-2 py-1 text-[13px] text-ink-2">
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function HubW2() {
  const [selected, setSelected] = useState<FlowId>("cardnews");
  const flow = FLOWS.find((f) => f.id === selected) ?? FLOWS[0];

  return (
    <Shell
      action={
        <Link
          href={flow.href}
          className={`flex h-9 items-center gap-2 rounded-lg bg-plum px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-plum-hover active:bg-plum-active ${FOCUS_RING} motion-reduce:transition-none`}
        >
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
          새로 만들기
        </Link>
      }
    >
      <PageHead
        title="무엇을 만들까요"
        meta="고르면 오른쪽에서 결과물의 형태를 미리 봐요"
        right={
          <StatStrip
            items={[
              { label: "만든 세트", value: "0" },
              { label: "카드 장수", value: "0" },
            ]}
          />
        }
      />

      <div className="grid gap-5 px-6 pb-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-3">
          {FLOWS.map((f) => (
            <FlowRow key={f.id} flow={f} selected={f.id === selected} onSelect={() => setSelected(f.id)} />
          ))}
        </ul>
        <LivePreview flow={flow} />
      </div>
    </Shell>
  );
}
