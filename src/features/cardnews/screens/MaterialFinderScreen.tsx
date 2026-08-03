"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, LoaderCircle, Search, TrendingUp, X } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LineButton, SectionHead, SolidButton, StudioFrame } from "@/features/shell/StudioFrame";
import { TopicSuggestPanel } from "./TopicSuggestPanel";
// 경과 시간 표기는 소재 추천 패널이 쓰던 것을 그대로 쓴다 — 같은 화면에서 두 표기가 갈리면 안 된다.
import { elapsedLabel } from "./topic-suggest";
import {
  FINDER_CATEGORIES,
  FINDER_SHOPPING_CATEGORIES,
  FINDER_MODES,
  RANK_LENSES,
  buildMaterialsQuery,
  buildTopicsQuery,
  lensAvailability,
  materialsSourceLine,
  toMaterialsView,
  type FinderMode,
  type MaterialsView,
  type RankLens,
} from "./material-finder";

/**
 * 화면 0(선택) — **소재 찾기.** 주제를 직접 타이핑하는 대신 뜨는 소재에서 골라 온다.
 *
 * **스텝은 0(주제) 그대로다.** 소재 찾기를 4번째 스텝으로 넣으면 필수처럼 보이는데, 이건
 * 건너뛸 수 있는 도구다. 고르면 주제 칸이 채워진 채 주제 화면으로 돌아간다.
 *
 * 모드는 **속도로 갈린다** — 급상승·키워드 찾기는 Claude 를 안 써서 1~2초에 영상 제목을 날것
 * 그대로 주고, 소재 추천만 100초를 들여 다듬는다. 지금까지는 느린 길밖에 없었다.
 *
 * **탭을 바꿔도 이미 가져온 결과를 지우지 않는다.** 그래서 출처는 화면의 현재 탭이 아니라
 * 결과에 담긴 `mode` 를 따른다(`materialsSourceLine`) — 안 그러면 급상승 결과를 띄운 채
 * 키워드 탭으로 옮겼을 때 출처가 거짓이 된다.
 *
 * 판단(모드·렌즈 목록, 응답 해석, 출처 문구)은 전부 `./material-finder` 의 순수 함수가 한다 —
 * 이 저장소 vitest 는 `environment: "node"` 라 렌더 테스트를 붙일 수 없어서다.
 */

type FetchState = { kind: "idle" } | { kind: "loading" } | { kind: "done"; view: MaterialsView };

/** 결과 목록. 누르면 그 제목이 주제가 된다 — 다듬는 건 주제 칸에서 하면 된다. */
function MaterialList({
  view,
  onPick,
}: {
  view: Extract<MaterialsView, { kind: "items" }>;
  onPick: (title: string) => void;
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {view.items.map((item, i) => (
        <li key={`${i}-${item.videoId}`}>
          <button
            type="button"
            onClick={() => onPick(item.title)}
            className={`flex h-full w-full flex-col gap-1.5 rounded-xl border-2 border-hair p-4 text-left transition-colors duration-200 hover:border-ink-3 ${FOCUS_RING} motion-reduce:transition-none`}
          >
            <span className="text-[16px] font-bold leading-snug tracking-tight">{item.title}</span>
            {item.channelTitle && <span className="text-[13px] text-ink-3">{item.channelTitle}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function MaterialFinderScreen({
  keyword,
  onPick,
  onClose,
}: {
  keyword: string;
  onPick: (keyword: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<FinderMode>("trending");
  const [categoryIds, setCategoryIds] = useState<string[]>(FINDER_CATEGORIES.map((c) => c.id));
  const [query, setQuery] = useState("");
  const [lens, setLens] = useState<RankLens>("search-trend");
  const [shoppingCategoryId, setShoppingCategoryId] = useState("");
  const [naverConfigured, setNaverConfigured] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);

  // 네이버 렌즈를 고를 수 있는지만 물어본다 — 키 값은 서버가 절대 내려주지 않는다.
  // 실패하면 false 로 두고 렌즈를 막되 이유를 보여 준다(조용히 열어 두면 100초 뒤에 실패한다).
  useEffect(() => {
    let alive = true;
    void fetch("/api/topics-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (!alive) return;
        const ok = typeof data === "object" && data !== null && (data as { naverConfigured?: unknown }).naverConfigured;
        setNaverConfigured(ok === true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (fetchState.kind !== "loading") return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [fetchState.kind]);

  // 화면을 떠나면 남은 요청을 끊는다.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function load() {
    // 같은 요청이 두 번 날아가지 않게 막는다 — 키워드 검색은 한 번에 100유닛이다.
    if (fetchState.kind === "loading") return;
    const controller = new AbortController();
    abortRef.current = controller;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setFetchState({ kind: "loading" });
    try {
      const res = await fetch(`/api/materials?${buildMaterialsQuery(mode, { categoryIds, query })}`, {
        signal: controller.signal,
      });
      const body: unknown = await res.json().catch(() => null);
      setFetchState({ kind: "done", view: toMaterialsView(res.status, body) });
    } catch {
      if (controller.signal.aborted) {
        setFetchState({ kind: "idle" });
        return;
      }
      setFetchState({
        kind: "done",
        view: { kind: "error", message: "소재를 가져오지 못했어요. 잠시 후 다시 시도해 주세요." },
      });
    } finally {
      abortRef.current = null;
    }
  }

  const loading = fetchState.kind === "loading";
  const activeMode = FINDER_MODES.find((m) => m.id === mode)!;
  const searchBlocked = mode === "search" && query.trim().length === 0;
  const shoppingBlocked = lens === "shopping" && !shoppingCategoryId;
  const view = fetchState.kind === "done" ? fetchState.view : null;
  const sourceLine = view ? materialsSourceLine(view) : null;

  return (
    <StudioFrame step={0} title="소재 찾기">
      <div className="flex flex-col gap-8 px-5 py-8 sm:px-8 lg:gap-10 lg:px-10 lg:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-balance text-[30px] font-black leading-[1.08] tracking-tight sm:text-[40px]">
            어떤 소재로 만들까요?
          </h2>
          <LineButton onClick={onClose}>
            <X size={16} aria-hidden="true" />
            그만두기
          </LineButton>
        </div>

        {/* 탭을 바꿔도 이미 가져온 결과는 남는다 — 견줘 보라고 일부러 지우지 않는다.
            `role="tab"` 을 쓰지 않는다: 그 역할을 붙이면 스크린리더가 화살표 키 이동을
            안내하는데 여기엔 그 동작이 없다. 못 지킬 약속 대신 `aria-pressed` 를 쓴다 —
            Tab 키로 옮기고 Enter 로 고르는, 실제로 되는 동작 그대로다. */}
        <div className="flex flex-col gap-3">
          <div role="group" aria-label="소재 찾는 방법" className="flex flex-wrap gap-2">
            {FINDER_MODES.map((m) => {
              const on = m.id === mode;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMode(m.id)}
                  className={`rounded-xl border-2 px-4 py-2.5 text-[15px] font-bold transition-colors duration-200 ${
                    on ? "border-ink bg-ink text-surface" : "border-hair hover:border-ink-3"
                  } ${FOCUS_RING} motion-reduce:transition-none`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="text-[14px] leading-relaxed text-ink-2">{activeMode.hint}</p>
        </div>

        {mode === "trending" && (
          <div className="flex flex-col gap-3">
            <SectionHead title="어디서 찾을까요" aside="여러 개 고를 수 있어요" />
            <div className="flex flex-wrap gap-2">
              {FINDER_CATEGORIES.map((c) => {
                const on = categoryIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-[15px] font-bold transition-colors duration-200 ${
                      on ? "border-ink" : "border-hair hover:border-ink-3"
                    } motion-reduce:transition-none`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setCategoryIds((prev) => (on ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                      }
                      className={`h-4 w-4 accent-ink ${FOCUS_RING}`}
                    />
                    {c.name}
                  </label>
                );
              })}
            </div>
            {categoryIds.length === 0 && (
              <p className="text-[13px] text-ink-2">하나도 안 고르면 전체에서 찾아요.</p>
            )}
          </div>
        )}

        {mode === "search" && (
          <div className="flex flex-col gap-2.5">
            <label htmlFor="material-q" className="text-[15px] font-bold text-ink-2">
              무엇을 찾을까요
            </label>
            <input
              id="material-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={60}
              placeholder="에어컨 전기세"
              className={`h-[56px] w-full rounded-xl border-2 border-hair bg-surface px-4 text-[18px] font-bold tracking-tight transition-colors duration-200 placeholder:font-normal placeholder:text-ink-3 focus:border-ink focus:outline-none sm:h-[64px] sm:px-5 sm:text-[22px] ${FOCUS_RING} motion-reduce:transition-none`}
            />
          </div>
        )}

        {mode === "curated" && (
          <div className="flex flex-col gap-3">
            <SectionHead title="무엇으로 줄 세울까요" />
            <div className="grid gap-3 sm:grid-cols-3">
              {RANK_LENSES.map((l) => {
                const { enabled, reason } = lensAvailability(l.id, naverConfigured);
                const on = l.id === lens;
                return (
                  <label
                    key={l.id}
                    className={`flex flex-col gap-1.5 rounded-xl border-2 p-4 transition-colors duration-200 ${
                      on ? "border-ink" : "border-hair"
                    } ${enabled ? "cursor-pointer hover:border-ink-3" : "opacity-60"} motion-reduce:transition-none`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rank-lens"
                        checked={on}
                        disabled={!enabled}
                        onChange={() => setLens(l.id)}
                        className={`h-4 w-4 accent-ink ${FOCUS_RING}`}
                      />
                      <span className="text-[16px] font-black tracking-tight">{l.label}</span>
                    </span>
                    <span className="text-[13px] leading-relaxed text-ink-2">{l.hint}</span>
                    {/* 못 쓰는 이유를 숨기지 않는다 — 숨기면 왜 회색인지 영영 모른다. */}
                    {reason && <span className="text-[13px] font-bold leading-relaxed">{reason}</span>}
                  </label>
                );
              })}
            </div>

            {lens === "shopping" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="shopping-category" className="text-[15px] font-bold text-ink-2">
                  어느 분야로 볼까요
                </label>
                <select
                  id="shopping-category"
                  value={shoppingCategoryId}
                  onChange={(e) => setShoppingCategoryId(e.target.value)}
                  className={`h-[52px] w-full max-w-sm rounded-xl border-2 border-hair bg-surface px-4 text-[16px] font-bold focus:border-ink focus:outline-none ${FOCUS_RING}`}
                >
                  <option value="">분야를 골라 주세요</option>
                  {FINDER_SHOPPING_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/*
          두 블록을 **둘 다 마운트한 채 숨긴다.** 조건부 렌더로 갈아 끼우면 언마운트되면서
          컴포넌트 로컬 state 가 날아가는데, 소재 추천 결과는 **100초를 들여 만든 것**이라
          탭을 한 번 다녀왔다고 잃으면 안 된다("결과를 지우지 않는다"는 약속도 깨진다).

          바깥 래퍼에 display 클래스를 두지 않는다 — Tailwind 의 `flex` 가 `[hidden]` 의
          `display:none` 을 이겨서 안 숨겨진다.
        */}
        <div hidden={mode !== "curated"}>
          <div className="flex flex-col gap-4">
            {shoppingBlocked && (
              <p role="status" className="text-[14px] font-bold">
                분야를 골라야 쇼핑인사이트로 줄 세울 수 있어요.
              </p>
            )}
            {/* 분야를 안 골랐어도 마운트는 유지한다 — 눌러도 서버가 Claude 단계 전에
                한국어로 막아 주므로 할당량이 새지 않는다. */}
            <TopicSuggestPanel
              keyword={keyword}
              query={buildTopicsQuery(lens, shoppingCategoryId)}
              onSelect={onPick}
            />
          </div>
        </div>

        <div hidden={mode === "curated"}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <SolidButton disabled={loading || searchBlocked} onClick={() => void load()}>
                {loading ? (
                  <LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                ) : mode === "search" ? (
                  <Search size={16} aria-hidden="true" />
                ) : (
                  <TrendingUp size={16} aria-hidden="true" />
                )}
                {loading ? "찾는 중" : fetchState.kind === "done" ? "다시 찾기" : "소재 찾기"}
              </SolidButton>
              {loading && <LineButton onClick={() => abortRef.current?.abort()}>그만두기</LineButton>}
              {loading && (
                <span aria-hidden="true" className="text-[14px] font-bold tabular-nums text-ink-2">
                  {elapsedLabel(elapsed)} 지났어요
                </span>
              )}
            </div>

            {view?.kind === "error" ? (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-bold text-surface"
              >
                <CircleAlert size={16} aria-hidden="true" className="flex-none" />
                {view.message}
              </p>
            ) : (
              <p role="status" className="text-[14px] leading-relaxed text-ink-2">
                {loading
                  ? "유튜브에서 찾는 중이에요."
                  : view?.kind === "empty"
                    ? "마땅한 게 없었어요. 다른 조건으로 찾아보거나 주제 칸에 직접 입력해 주세요."
                    : view?.kind === "items"
                      ? `${view.items.length}개를 찾았어요. 하나를 누르면 주제가 돼요.`
                      : "조건을 고르고 눌러 주세요."}
              </p>
            )}

            {view && view.kind !== "error" && (
              <div className="flex flex-col gap-3">
                {sourceLine && (
                  <dl className="flex flex-wrap gap-x-2 rounded-xl border border-hair px-4 py-3 text-[13px] leading-relaxed">
                    <dt className="font-bold">후보</dt>
                    <dd className="text-ink-2">{sourceLine}</dd>
                  </dl>
                )}
                {view.skipped.length > 0 && (
                  <p className="text-[13px] leading-relaxed text-ink-2">
                    유튜브 {view.skipped.join(", ")} 카테고리는 오늘 가져오지 못해 빼고 찾았어요.
                  </p>
                )}
                {view.kind === "items" && <MaterialList view={view} onPick={onPick} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </StudioFrame>
  );
}
