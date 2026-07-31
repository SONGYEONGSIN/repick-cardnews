"use client";

import { Sparkles } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { THEMES, THEME_IDS } from "@/templates/themes";
import { CardRenderer, type RenderCard } from "@/templates/CardRenderer";
import { DEFAULT_BAND_CARDNEWS, DEFAULT_FOCAL, DEFAULT_SCRIM } from "@/templates/layout-utils";
import { cardnewsFixture } from "@/lib/fixtures";
import { slotPhotos, type CardnewsAction, type CardnewsState } from "../reducer";
import { requestSpec } from "@/features/studio/useGenerate";
import type { CardnewsSpec } from "@/lib/schema";

const INPUT =
  "h-11 w-full rounded-lg border border-hair bg-surface px-3.5 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

export function TopicStep({
  state,
  dispatch,
  onDone,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
  onDone: () => void;
}) {
  async function generate() {
    dispatch({ type: "SET_BUSY", busy: true });
    dispatch({ type: "SET_ERROR", error: null });
    try {
      const spec = await requestSpec<CardnewsSpec>({
        type: "cardnews",
        keyword: state.keyword,
        photos: slotPhotos(state).map((p) => p.thumbUrl),
      });
      dispatch({ type: "SET_SPEC", spec });
      dispatch({ type: "SET_BUSY", busy: false });
      onDone();
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "카피 생성에 실패했어요" });
    }
  }

  // 카피 생성 전이라 문구는 샘플이다. 사진·테마·워터마크는 실제 상태를 그대로 비추므로
  // 테마를 고르거나 핸들을 입력하면 그 자리에서 결과가 어떻게 보이는지 확인할 수 있다.
  const previewCard: RenderCard = {
    layout: "full-bleed",
    photoUrl: slotPhotos(state)[0]?.dataUrl ?? null,
    focal: DEFAULT_FOCAL,
    scrim: DEFAULT_SCRIM,
    band: DEFAULT_BAND_CARDNEWS,
    badge: `1 / ${state.order.length}`,
    copy: cardnewsFixture.cards[0],
  };

  return (
    <div className="mx-auto grid w-full max-w-[920px] gap-8 lg:grid-cols-[minmax(0,1fr)_324px]">
      <div className="flex min-w-0 flex-col gap-6">
      <Field label="키워드" htmlFor="keyword" hint="사진과 함께 Claude에게 전달돼요.">
        <input
          id="keyword"
          value={state.keyword}
          onChange={(e) => dispatch({ type: "SET_KEYWORD", keyword: e.target.value })}
          placeholder="예: 에어컨 전기세 절약"
          className={INPUT}
        />
      </Field>

      <Field label="워터마크" htmlFor="handle" hint="비워 두면 카드에 아무것도 찍히지 않아요.">
        <input
          id="handle"
          value={state.handle}
          onChange={(e) => dispatch({ type: "SET_HANDLE", handle: e.target.value })}
          placeholder="@계정명"
          className={INPUT}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">테마</legend>
        <div className="flex gap-2">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={state.themeId === id}
              onClick={() => dispatch({ type: "SET_THEME", themeId: id })}
              className={`flex-1 rounded-lg border-2 px-2 py-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum motion-reduce:transition-none ${
                state.themeId === id ? "border-plum" : "border-hair"
              }`}
              style={{
                // 테마 색은 런타임 데이터라 Tailwind 클래스로 표현할 수 없다 — themes.ts 값을 그대로 비춘다
                background: THEMES[id].bg,
                color: THEMES[id].fg,
              }}
            >
              {THEMES[id].label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button variant="primary" onClick={generate} disabled={state.busy || state.keyword.trim().length === 0}>
        <Sparkles size={15} aria-hidden="true" />
        {state.busy ? "사진을 보고 쓰는 중이에요…" : "카피 생성"}
      </Button>

        {state.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>

      <aside className="flex flex-col gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">미리보기</h2>
        {/* 1080×1350 원본을 30%로 줄여 담는 고정 크기 박스 — 컨테이너 픽셀에서 역산한 값이다 */}
        <div className="overflow-hidden rounded-xl border border-hair shadow-sm" style={{ width: 324, height: 405 }}>
          <div className="origin-top-left scale-30">
            <CardRenderer card={previewCard} themeId={state.themeId} handle={state.handle} />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-ink-3">
          고른 테마와 워터마크가 바로 반영돼요. 문구는 카피를 생성하면 바뀝니다.
        </p>
      </aside>
    </div>
  );
}
