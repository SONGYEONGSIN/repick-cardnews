"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, LoaderCircle, TrendingUp } from "lucide-react";
import { FOCUS_RING } from "@/components/ui";
import { LineButton, SectionHead } from "@/features/shell/StudioFrame";
import {
  CANDIDATE_SOURCE,
  TOPICS_IDLE_HINT,
  candidateSourceLine,
  elapsedLabel,
  errorView,
  panelStatus,
  selectedKeyword,
  toTopicsView,
  waitingStatus,
  type BasisView,
  type TopicsView,
} from "./topic-suggest";

/**
 * 주제 화면의 **보조** 블록 — 요즘 뜨는 것 중에서 주제를 고른다.
 *
 * 화면의 축은 어디까지나 위의 주제 입력이다. 이 블록은 그 칸을 채워 주는 도구라 눌러 고른
 * 결과도 그냥 `keyword` 가 된다 — 고른 주제를 따로 저장하지 않으므로 잘못 골랐으면 위 칸에서
 * 고치거나 다른 후보를 누르면 그만이다(고른 것은 지금 `keyword` 와 같은 후보로 되짚는다).
 *
 * **화면에 들어왔다고 자동으로 부르지 않는다.** `/api/topics` 는 Claude 추리기를 포함해 실측
 * 100초 안팎이 걸린다 — 자동 호출은 사용자를 100초 동안 세워 두고 할당량도 태운다. 버튼을
 * 눌렀을 때만 한 번 부르고(도는 동안 버튼은 잠긴다) 도중에 그만둘 수 있다(`AbortController`).
 * 화면을 떠나면 남은 요청도 끊는다.
 *
 * 기다리는 동안 스피너만 두지 않는다 — 예상 시간을 미리 말하고(`TOPICS_IDLE_HINT`), 도는
 * 동안에는 경과 시간이 1초마다 올라가 멈추지 않았음을 보인다. 그 숫자는 `aria-hidden` 이다
 * (라이브 영역에 두면 스크린리더가 1초마다 다시 읽는다). 읽어 줄 문장은 굵게 나뉜 두 단계뿐
 * (`waitingStatus`).
 *
 * 응답 판정(순위 근거·결과 없음·부족·오류)은 전부 `topic-suggest.ts` 의 순수 함수가 한다.
 */

type PanelState = { kind: "idle" } | { kind: "loading" } | { kind: "done"; view: TopicsView };

/**
 * 출처 블록 — **어디서 가져왔고 무엇이 줄을 세웠는지**를 결과 바로 위에 붙인다.
 *
 * 유튜브와 데이터랩이 경쟁하는 두 출처처럼 보이면 안 된다. 둘은 단계가 다르다: 후보는 언제나
 * 유튜브에서 오고, 데이터랩은 그 후보를 줄 세울 뿐이다. 그래서 `후보`·`순위` 두 줄로 못 박는다.
 */
function SourceBlock({ candidate, basis }: { candidate: string; basis: BasisView }) {
  return (
    <dl className="flex flex-col gap-1.5 rounded-xl border border-hair px-4 py-3 text-[13px] leading-relaxed">
      <div className="flex flex-wrap gap-x-2">
        <dt className="font-bold">후보</dt>
        <dd className="text-ink-2">{candidate}</dd>
      </div>
      {basis.note && (
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-bold">순위</dt>
          <dd className={basis.needsAttention ? "flex items-start gap-1.5 font-bold" : "text-ink-2"}>
            {basis.needsAttention && <CircleAlert size={15} aria-hidden="true" className="mt-0.5 flex-none" />}
            {basis.note}
          </dd>
        </div>
      )}
    </dl>
  );
}

function TopicList({
  view,
  keyword,
  onSelect,
}: {
  view: Extract<TopicsView, { kind: "results" }>;
  keyword: string;
  onSelect: (keyword: string) => void;
}) {
  const chosen = selectedKeyword(view.topics, keyword);
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {view.topics.map((topic, i) => {
        const selected = topic.keyword === chosen;
        return (
          <li key={`${i}-${topic.keyword}`}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(topic.keyword)}
              className={`flex h-full w-full flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-colors duration-200 ${
                selected ? "border-ink" : "border-hair hover:border-ink-3"
              } ${FOCUS_RING} motion-reduce:transition-none`}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
                    selected ? "bg-ink text-surface" : "border border-hair text-ink-3"
                  }`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="text-[17px] font-black tracking-tight">{topic.keyword}</span>
                {selected && (
                  <span className="rounded bg-ink px-2 py-0.5 text-[12px] font-bold text-surface">선택</span>
                )}
              </span>
              {topic.reason && <span className="text-[14px] leading-relaxed text-ink-2">{topic.reason}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function TopicSuggestPanel({
  keyword,
  onSelect,
}: {
  keyword: string;
  onSelect: (keyword: string) => void;
}) {
  const [panel, setPanel] = useState<PanelState>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);

  // 도는 동안에만 경과 시간을 센다. 시작 시각으로 다시 계산한다 — 1초씩 더하면 탭이 뒤로
  // 밀렸을 때(브라우저가 타이머를 늦춘다) 실제보다 적게 세서 "덜 걸린 척"하게 된다.
  useEffect(() => {
    if (panel.kind !== "loading") return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [panel.kind]);

  // 화면을 떠나면(주제 화면을 벗어나면) 남은 요청을 끊는다 — 돌아오지 않을 응답을 100초 동안
  // 붙들고 있을 이유가 없다.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function load() {
    // 같은 요청이 두 번 날아가지 않게 막는다 — 100초짜리 호출이 겹치면 할당량만 먹는다.
    if (panel.kind === "loading") return;
    const controller = new AbortController();
    abortRef.current = controller;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setPanel({ kind: "loading" });
    try {
      const res = await fetch("/api/topics", { signal: controller.signal });
      const body: unknown = await res.json().catch(() => null);
      setPanel({ kind: "done", view: toTopicsView(res.status, body) });
    } catch (e) {
      // 그만두기(또는 화면 이탈)는 오류가 아니다 — 누르기 전 상태로 되돌린다.
      if (controller.signal.aborted) {
        setPanel({ kind: "idle" });
        return;
      }
      setPanel({ kind: "done", view: errorView(e instanceof Error ? e.message : "") });
    } finally {
      abortRef.current = null;
    }
  }

  const loading = panel.kind === "loading";
  const failed = panel.kind === "done" && panel.view.kind === "error";
  const status =
    panel.kind === "loading"
      ? waitingStatus(elapsed)
      : panel.kind === "done"
        ? panelStatus(panel.view, keyword)
        : TOPICS_IDLE_HINT;

  return (
    <section className="flex flex-col gap-4">
      <SectionHead title="요즘 뜨는 주제에서 고르기" aside="직접 입력해도 돼요" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <LineButton disabled={loading} onClick={() => void load()}>
          {loading ? (
            <LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <TrendingUp size={16} aria-hidden="true" />
          )}
          {loading ? "주제 고르는 중" : panel.kind === "done" ? "다시 가져오기" : "요즘 뜨는 주제 보기"}
        </LineButton>
        {loading && <LineButton onClick={() => abortRef.current?.abort()}>그만두기</LineButton>}
        {loading && (
          // 멈추지 않았다는 것을 눈으로 보이는 자리. 1초마다 바뀌므로 라이브 영역에 넣지 않는다.
          <span aria-hidden="true" className="text-[14px] font-bold tabular-nums text-ink-2">
            {elapsedLabel(elapsed)} 지났어요
          </span>
        )}
      </div>

      {failed ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[14px] font-bold text-surface"
        >
          <CircleAlert size={16} aria-hidden="true" className="flex-none" />
          {status}
        </p>
      ) : (
        <p role="status" className="text-[14px] leading-relaxed text-ink-2">
          {status}
        </p>
      )}

      {panel.kind === "done" && panel.view.kind !== "error" && (
        <div className="flex flex-col gap-3">
          <SourceBlock candidate={candidateSourceLine(panel.view) ?? CANDIDATE_SOURCE} basis={panel.view.basis} />
          {/* 후보가 상한보다 적을 때 서버가 준 설명 — 결과가 있는 경우에만 여기 둔다.
              결과가 없을 때는 위 상태 한 줄(panelStatus)이 이미 같은 문장을 말한다. */}
          {panel.view.kind === "results" && panel.view.message && (
            <p className="text-[13px] leading-relaxed text-ink-2">{panel.view.message}</p>
          )}
          {panel.view.skipped.length > 0 && (
            <p className="text-[13px] leading-relaxed text-ink-2">
              유튜브 {panel.view.skipped.join(", ")} 카테고리는 오늘 가져오지 못해 빼고 골랐어요.
            </p>
          )}
          {panel.view.kind === "results" && (
            <TopicList view={panel.view} keyword={keyword} onSelect={onSelect} />
          )}
        </div>
      )}
    </section>
  );
}
