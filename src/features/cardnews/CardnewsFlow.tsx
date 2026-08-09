"use client";

import { useReducer, useState } from "react";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { TopicScreen } from "./screens/TopicScreen";
import { MaterialFinderScreen } from "./screens/MaterialFinderScreen";
import { WorkbenchScreen } from "./screens/WorkbenchScreen";
import { ExportScreen } from "./screens/ExportScreen";
import { toRenderCards } from "./render";
import { cardnewsReducer, initialCardnewsState } from "./reducer";
import type { LedgerEntry } from "@/lib/ledger";

export function CardnewsFlow({
  recent,
  initialKeyword = "",
}: {
  recent: readonly LedgerEntry[];
  /** 정보전달에서 형태를 바꿔 넘어올 때 들고 온 주제 — 없으면 빈 칸으로 시작한다. */
  initialKeyword?: string;
}) {
  const [state, dispatch] = useReducer(cardnewsReducer, { ...initialCardnewsState, keyword: initialKeyword });
  // 소재 찾기는 **스텝이 아니다.** reducer 의 step 을 늘리면 진행 표시에 끼어들어 필수처럼
  // 보인다 — 건너뛸 수 있는 도구이므로 이 화면의 로컬 상태로만 여닫는다.
  const [finderOpen, setFinderOpen] = useState(false);
  const { registerRef, download, saveToFolder, captureImages } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });

  return (
    <>
      {state.step === 0 &&
        (finderOpen ? (
          <MaterialFinderScreen
            keyword={state.keyword}
            onPick={(keyword) => {
              dispatch({ type: "SET_KEYWORD", keyword });
              setFinderOpen(false);
            }}
            onClose={() => setFinderOpen(false)}
          />
        ) : (
          <TopicScreen
            state={state}
            dispatch={dispatch}
            onNext={() => go(1)}
            onOpenFinder={() => setFinderOpen(true)}
            recent={recent}
          />
        ))}

      {state.step === 1 && (
        <WorkbenchScreen state={state} dispatch={dispatch} onPrev={() => go(0)} onNext={() => go(2)} />
      )}

      {state.step === 2 && (
        <ExportScreen
          state={state}
          dispatch={dispatch}
          onPrev={() => go(1)}
          onDownload={() => download(state.cards.length, state.keyword)}
          onSave={() =>
            saveToFolder({
              count: state.cards.length,
              keyword: state.keyword,
              type: "cardnews",
              templateIds: state.cards.map((c) => c.layout),
            })
          }
          onCaptureImages={captureImages}
        />
      )}

      {state.cards.length > 0 && (
        <CaptureStage
          cards={toRenderCards(state)}
          themeId={state.themeId}
          // 카드뉴스는 계정 핸들 워터마크를 쓰지 않는다 — 빈 문자열이면 CardFrame이 안 그린다.
          handle=""
          ad={state.ad}
          registerRef={registerRef}
        />
      )}
    </>
  );
}
