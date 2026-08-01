"use client";

import { useReducer } from "react";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { TopicScreen } from "./screens/TopicScreen";
import { toRenderCards } from "./render";
import { cardnewsReducer, initialCardnewsState } from "./reducer";

export function CardnewsFlow() {
  const [state, dispatch] = useReducer(cardnewsReducer, initialCardnewsState);
  const { registerRef } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });

  return (
    <>
      {state.step === 0 && <TopicScreen state={state} dispatch={dispatch} onNext={() => go(1)} />}

      {state.cards.length > 0 && (
        <CaptureStage
          cards={toRenderCards(state)}
          themeId={state.themeId}
          handle={state.handle}
          registerRef={registerRef}
        />
      )}
    </>
  );
}
