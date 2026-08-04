"use client";

import { useReducer } from "react";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { InfoTopicScreen } from "./screens/InfoTopicScreen";
import { InfoWorkbenchScreen } from "./screens/InfoWorkbenchScreen";
import { InfoExportScreen } from "./screens/InfoExportScreen";
import { toRenderCard } from "./render";
import { infoReducer, initialInfoState } from "./reducer";

/**
 * 정보전달 흐름 — **카드뉴스와 같은 3화면**(주제 → 만들기 → 내보내기).
 *
 * 예전엔 `StudioShell` 위의 4단계 위저드(사진 · 주제 · 편집 · 내보내기)였다. 두 형식이 같은
 * 도구인데 흐름이 달라, 오가는 사람이 규칙을 두 번 배워야 했다. 사진 단계를 없애고(사진은
 * 이제 선택) '만들기' 안으로 넣었다 — `CardnewsFlow` 와 같은 모양이다.
 */
export function InfoFlow() {
  const [state, dispatch] = useReducer(infoReducer, initialInfoState);
  const { registerRef, download, saveToFolder } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });
  const card = toRenderCard(state);

  return (
    <>
      {state.step === 0 && <InfoTopicScreen state={state} dispatch={dispatch} onNext={() => go(1)} />}

      {state.step === 1 && (
        <InfoWorkbenchScreen state={state} dispatch={dispatch} onPrev={() => go(0)} onNext={() => go(2)} />
      )}

      {state.step === 2 && (
        <InfoExportScreen
          state={state}
          dispatch={dispatch}
          onPrev={() => go(1)}
          onDownload={() => download(1, state.keyword)}
          onSave={() =>
            saveToFolder({
              count: 1,
              keyword: state.keyword,
              type: "informationsend",
              templateIds: ["split"],
            })
          }
        />
      )}

      {card && (
        <CaptureStage cards={[card]} themeId={state.themeId} handle={state.handle} registerRef={registerRef} />
      )}
    </>
  );
}
