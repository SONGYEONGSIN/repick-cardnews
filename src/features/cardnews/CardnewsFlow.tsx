"use client";

import { useReducer } from "react";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { TopicScreen } from "./screens/TopicScreen";
import { WorkbenchScreen } from "./screens/WorkbenchScreen";
import { ExportScreen } from "./screens/ExportScreen";
import { toRenderCards } from "./render";
import { cardnewsReducer, initialCardnewsState } from "./reducer";

export function CardnewsFlow() {
  const [state, dispatch] = useReducer(cardnewsReducer, initialCardnewsState);
  const { registerRef, download, saveToFolder, captureImages } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });

  return (
    <>
      {state.step === 0 && <TopicScreen state={state} dispatch={dispatch} onNext={() => go(1)} />}

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
          registerRef={registerRef}
        />
      )}
    </>
  );
}
