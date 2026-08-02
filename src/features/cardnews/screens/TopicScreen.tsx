"use client";

import type { Dispatch } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { StudioFrame, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { canLeaveTopic, type CardnewsAction, type CardnewsState } from "../reducer";

/**
 * 화면 1 — 주제. `src/app/lab2/Hub.tsx` 시안을 실제 상태에 물렸다.
 *
 * 도구를 열 때 사용자가 들고 오는 건 주제지 "무엇을 만들까"가 아니다. 그래서 주제 입력이
 * 화면의 축이고 종류는 그 아래로 내렸다.
 *
 * 액센트 색이 없으므로 선택 상태는 검정 테두리 2px 과 검정 배지로만 표현한다.
 *
 * 종류는 카드뉴스로 고정된다 — 정보전달(조각 3)은 아직 이 플로우로 전환할 수 없어 `/info` 의
 * 기존 플로우로 보내는 링크로만 둔다. 최근 목록은 서버 데이터(`readRecent`)가 필요한데 이 화면은
 * 클라이언트 컴포넌트라 조각 2 로 미룬다 — 빈 목록을 가짜로 보여 주지 않는다.
 */
export function TopicScreen({
  state,
  dispatch,
  onNext,
}: {
  state: CardnewsState;
  dispatch: Dispatch<CardnewsAction>;
  onNext: () => void;
}) {
  return (
    <StudioFrame step={0} title="새로 만들기">
      <div className="flex flex-col gap-10 px-5 py-8 sm:px-8 lg:gap-12 lg:px-10 lg:py-12">
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
              value={state.keyword}
              onChange={(e) => dispatch({ type: "SET_KEYWORD", keyword: e.target.value })}
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
            <div className="flex flex-col gap-2.5 rounded-xl border-2 border-ink p-5 text-left sm:p-6">
              <span className="flex items-center gap-2.5">
                <span className="text-[20px] font-black tracking-tight sm:text-[24px]">카드뉴스</span>
                <span className="rounded bg-ink px-2 py-0.5 text-[12px] font-bold text-surface">선택</span>
              </span>
              <span className="text-[15px] font-bold text-ink-2">사진 5~6장 · 넘겨 보는 한 덩어리</span>
              {/* 카드마다 맡는 역할(후크·문제·근거·해법·행동)은 카피를 만드는 내부 규칙이다.
                  사용자에게는 그 이름 대신 **결과로 무엇이 되는지**를 말한다. */}
              <span className="text-[14px] leading-relaxed text-ink-2">
                첫 장에서 눈길을 끌고 마지막 장에서 저장하고 싶어지도록 카피를 써요.
              </span>
            </div>

            <Link
              href="/info"
              className={`flex flex-col gap-2.5 rounded-xl border-2 border-hair p-5 text-left transition-colors duration-200 hover:border-ink-3 sm:p-6 ${FOCUS_RING} motion-reduce:transition-none`}
            >
              <span className="text-[20px] font-black tracking-tight sm:text-[24px]">정보전달</span>
              <span className="text-[15px] font-bold text-ink-2">사진 1장 · 정보를 얹은 인포그래픽 한 장</span>
              <span className="text-[14px] leading-relaxed text-ink-2">
                제목과 항목 3~4개, 마지막에 팁 한 줄이 들어가요.
              </span>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <SolidButton size="lg" disabled={!canLeaveTopic(state)} onClick={onNext}>
            사진 올리러 가기
            <ArrowRight size={18} aria-hidden="true" />
          </SolidButton>
          <p className="text-[14px] text-ink-2">다음 화면에서 사진을 올리고 카피를 붙여요.</p>
        </div>
      </div>
    </StudioFrame>
  );
}
