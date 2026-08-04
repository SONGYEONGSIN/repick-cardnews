"use client";

import type { Dispatch } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { StudioFrame, LineButton, SectionHead, SolidButton } from "@/features/shell/StudioFrame";
import { switchHref } from "@/features/studio/switch-format";
import { ITEMS_MAX, ITEMS_MIN, canLeaveInfoTopic, type InfoAction, type InfoState } from "../reducer";

/**
 * 화면 1 — 주제. 카드뉴스 `TopicScreen` 과 **같은 골격**이다. 두 형식이 같은 흐름을 쓰므로
 * 화면도 같은 자리에서 같은 모양이어야 한다 — 오가며 다른 규칙을 배우게 하지 않는다.
 *
 * 종류 고르기에서 카드뉴스를 누르면 그 흐름으로 넘어간다(반대쪽 화면이 여기로 보내는 것과 같다).
 */
export function InfoTopicScreen({
  state,
  dispatch,
  onNext,
  onOpenFinder,
}: {
  state: InfoState;
  dispatch: Dispatch<InfoAction>;
  onNext: () => void;
  onOpenFinder: () => void;
}) {
  return (
    <StudioFrame step={0} title="새로 만들기">
      <div className="flex flex-col gap-10 px-5 py-8 sm:px-8 lg:gap-12 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-6 lg:gap-7">
          <h2 className="text-balance text-[34px] font-black leading-[1.06] tracking-tight sm:text-[44px] lg:text-[60px]">
            무슨 정보를 한 장에 담을까요?
          </h2>

          <div className="flex flex-col gap-2.5">
            <label htmlFor="info-kw" className="text-[15px] font-bold text-ink-2">
              주제
            </label>
            <input
              id="info-kw"
              value={state.keyword}
              onChange={(e) => dispatch({ type: "SET_KEYWORD", keyword: e.target.value })}
              maxLength={60}
              placeholder="여름 전기세 줄이는 법"
              className={`h-[60px] w-full rounded-xl border-2 border-hair bg-surface px-4 text-[19px] font-bold tracking-tight transition-colors duration-200 placeholder:font-normal placeholder:text-ink-3 focus:border-ink focus:outline-none sm:h-[68px] sm:px-5 sm:text-[24px] ${FOCUS_RING} motion-reduce:transition-none`}
            />
            <p className="text-[14px] text-ink-2">
              구체적일수록 좋아요. &ldquo;전기세&rdquo;보다 &ldquo;여름 전기세 줄이는 법&rdquo;처럼요.
            </p>
          </div>
        </div>

        {/* 소재 찾기는 **선택적 도구**다 — 카드뉴스와 같은 화면, 같은 자리. 고른 결과는 그냥
            keyword 가 되므로 돌아와서 위 칸에서 그대로 고칠 수 있다. 스텝으로 만들지 않는
            이유도 같다(스텝에 넣으면 필수처럼 보인다). */}
        <div className="flex flex-wrap items-center gap-4">
          <LineButton onClick={onOpenFinder}>
            <Sparkles size={16} aria-hidden="true" />
            소재 찾기
          </LineButton>
          <p className="text-[14px] text-ink-2">뭘 만들지 안 정해졌으면 요즘 뜨는 것 중에서 골라 올 수 있어요.</p>
        </div>

        <div className="flex flex-col gap-4">
          <SectionHead title="어떤 형태로" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href={switchHref("/", state.keyword)}
              className={`flex flex-col gap-2.5 rounded-xl border-2 border-hair p-5 text-left transition-colors duration-200 hover:border-ink-3 hover:bg-hair-soft sm:p-6 ${FOCUS_RING} motion-reduce:transition-none`}
            >
              <span className="text-[20px] font-black tracking-tight sm:text-[24px]">카드뉴스</span>
              <span className="text-[15px] font-bold text-ink-2">사진 5~6장 · 넘겨 보는 한 덩어리</span>
              <span className="text-[14px] leading-relaxed text-ink-2">
                첫 장에서 눈길을 끌고 마지막 장에서 저장하고 싶어지도록 카피를 써요.
              </span>
            </Link>

            <div className="flex flex-col gap-2.5 rounded-xl border-2 border-ink p-5 text-left sm:p-6">
              <span className="flex items-center gap-2.5">
                <span className="text-[20px] font-black tracking-tight sm:text-[24px]">정보전달</span>
                <span className="rounded bg-ink px-2 py-0.5 text-[12px] font-bold text-surface">선택</span>
              </span>
              <span className="text-[15px] font-bold text-ink-2">한 장 · 정보를 얹은 인포그래픽</span>
              {/* 사진이 선택이라는 사실을 여기서부터 말해 준다 — 다음 화면에서 처음 알면 늦다. */}
              <span className="text-[14px] leading-relaxed text-ink-2">
                제목과 항목 {ITEMS_MIN}~{ITEMS_MAX}개, 마지막에 팁 한 줄이 들어가요. 사진은 없어도 돼요.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <SolidButton size="lg" disabled={!canLeaveInfoTopic(state)} onClick={onNext}>
            만들러 가기
            <ArrowRight size={18} aria-hidden="true" />
          </SolidButton>
          <p className="text-[14px] text-ink-2">다음 화면에서 카피를 만들고 고쳐요.</p>
        </div>
      </div>
    </StudioFrame>
  );
}
