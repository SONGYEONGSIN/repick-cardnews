"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { StudioFrame, SectionHead, SolidButton } from "@/features/shell/StudioFrame";

/**
 * 화면 1 — 주제. 기존 허브(선택지 카드)와 1단계(주제 입력)를 합쳤다.
 *
 * 도구를 열 때 사용자가 들고 오는 건 주제지 "무엇을 만들까"가 아니다. 그래서 주제 입력이
 * 화면의 축이고 종류는 그 아래로 내렸다.
 *
 * 액센트 색이 없으므로 선택 상태는 검정 테두리 2px 과 검정 배지로만 표현한다.
 */

const KINDS = [
  {
    id: "cardnews",
    title: "카드뉴스",
    line: "사진 5~6장 · 넘겨 보는 설득 시퀀스",
    detail: "후크 → 문제 → 근거 → 해법 → 행동 순으로 카피가 붙어요.",
  },
  {
    id: "info",
    title: "정보전달",
    line: "사진 1장 · 정보를 얹은 인포그래픽 한 장",
    detail: "제목과 항목 3~4개, 마지막에 팁 한 줄이 들어가요.",
  },
] as const;

type KindId = (typeof KINDS)[number]["id"];

const RECENT = [
  { keyword: "장마철 습기 관리", kind: "정보전달", when: "어제", count: 1 },
  { keyword: "여름 휴가 준비", kind: "카드뉴스", when: "3일 전", count: 5 },
  { keyword: "에어컨 전기세", kind: "카드뉴스", when: "지난주", count: 5 },
];

export function Hub() {
  const [kind, setKind] = useState<KindId>("cardnews");
  const [keyword, setKeyword] = useState("");

  return (
    <StudioFrame step={0} title="새로 만들기">
      <div className="grid gap-10 px-5 py-8 sm:px-8 lg:gap-14 lg:px-10 lg:py-12 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-10 lg:gap-12">
          <div className="flex flex-col gap-6 lg:gap-7">
            {/* 폭 제한을 걸지 않는다 — 공간이 있으면 한 줄로 가고, 좁아지면 balance 가 두 줄을 고르게 나눈다.
                고정 max-w 는 오른쪽이 비어 있을 때 의도가 아니라 결함으로 읽힌다. */}
            <h2 className="text-balance text-[34px] font-black leading-[1.06] tracking-tight sm:text-[44px] lg:text-[60px]">
              무슨 이야기를 카드로 만들까요?
            </h2>

            <div className="flex flex-col gap-2.5">
              <label htmlFor="kw" className="text-[15px] font-bold text-ink-2">
                주제
              </label>
              <input
                id="kw"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                maxLength={60}
                placeholder="에어컨 전기세"
                className={`h-[60px] w-full rounded-xl border-2 border-hair bg-surface px-4 text-[19px] sm:h-[68px] sm:px-5 sm:text-[24px] font-bold tracking-tight transition-colors duration-200 placeholder:font-normal placeholder:text-ink-3 focus:border-ink focus:outline-none ${FOCUS_RING} motion-reduce:transition-none`}
              />
              <p className="text-[14px] text-ink-2">
                구체적일수록 좋아요. &ldquo;여름 전기세&rdquo;보다 &ldquo;에어컨 전기세 줄이는 법&rdquo;처럼요.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SectionHead title="어떤 형태로" />
            <div className="grid gap-4 sm:grid-cols-2">
              {KINDS.map((k) => {
                const on = k.id === kind;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    aria-pressed={on}
                    className={`flex flex-col gap-2.5 rounded-xl border-2 p-5 text-left sm:p-6 transition-colors duration-200 ${FOCUS_RING} motion-reduce:transition-none ${
                      on ? "border-ink" : "border-hair hover:border-ink-3"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-[20px] font-black tracking-tight sm:text-[24px]">{k.title}</span>
                      {on && (
                        <span className="rounded bg-ink px-2 py-0.5 text-[12px] font-bold text-surface">선택</span>
                      )}
                    </span>
                    <span className="text-[15px] font-bold text-ink-2">{k.line}</span>
                    <span className="text-[14px] leading-relaxed text-ink-2">{k.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <SolidButton size="lg" disabled={keyword.trim().length === 0}>
              사진 올리러 가기
              <ArrowRight size={18} aria-hidden="true" />
            </SolidButton>
            <p className="text-[14px] text-ink-2">다음 화면에서 사진을 올리고 카피를 붙여요.</p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <SectionHead title="최근" aside={`${RECENT.length}개`} />
          <ul className="flex flex-col">
            {RECENT.map((r) => (
              <li key={r.keyword}>
                <button
                  type="button"
                  className={`flex w-full flex-col gap-1 border-b border-hair-soft py-4 text-left transition-colors duration-200 hover:bg-canvas ${FOCUS_RING} motion-reduce:transition-none`}
                >
                  <span className="truncate text-[16px] font-bold tracking-tight">{r.keyword}</span>
                  <span className="text-[14px] text-ink-2">
                    {r.kind} · {r.count}장 · {r.when}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </StudioFrame>
  );
}
