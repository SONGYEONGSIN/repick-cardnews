"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { StudioShell } from "@/features/shell/StudioShell";
import type { StepDef } from "@/features/shell/types";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { PhotosStep } from "./steps/PhotosStep";
import { OrderStep } from "./steps/OrderStep";
import { TopicStep } from "./steps/TopicStep";
import { ComposeStep } from "./steps/ComposeStep";
import { ExportStep } from "./steps/ExportStep";
import { toRenderCards } from "./render";
import {
  CARDNEWS_MIN,
  canLeaveOrder,
  cardnewsReducer,
  initialCardnewsState,
} from "./reducer";

const STEPS: StepDef[] = [
  { id: 1, label: "사진" },
  { id: 2, label: "순서 정하기" },
  { id: 3, label: "주제" },
  { id: 4, label: "편집" },
  { id: 5, label: "내보내기" },
];

export function CardnewsFlow() {
  const [state, dispatch] = useReducer(cardnewsReducer, initialCardnewsState);
  const router = useRouter();
  const { registerRef, download, saveToFolder } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });

  const gate = (): { ok: boolean; hint?: string } => {
    if (state.step === 1) {
      const short = CARDNEWS_MIN - state.order.length;
      if (short > 0) return { ok: false, hint: `사진이 ${short}장 더 필요해요.` };
      return { ok: true };
    }
    if (state.step === 2) {
      return canLeaveOrder(state) ? { ok: true } : { ok: false, hint: "사진 5~6장을 슬롯에 채워 주세요." };
    }
    if (state.step === 3) {
      return state.cards.length > 0
        ? { ok: true }
        : { ok: false, hint: "카피를 먼저 생성해 주세요." };
    }
    return { ok: true };
  };

  const { ok, hint } = gate();

  function exit() {
    const dirty = state.photos.length > 0;
    if (dirty && !window.confirm("만들던 카드뉴스가 사라져요. 나갈까요?")) return;
    router.push("/");
  }

  return (
    <>
      <StudioShell
        flowLabel="카드뉴스"
        steps={STEPS}
        current={state.step}
        maxReached={state.maxReached}
        onSelectStep={go}
        meta={`사진 ${state.photos.length}장 · 카드 ${state.order.length}장`}
        onReset={() => dispatch({ type: "RESET" })}
        onExit={exit}
        footer={{
          onPrev: state.step > 1 ? () => go(state.step - 1) : undefined,
          onNext: state.step < 5 ? () => go(state.step + 1) : undefined,
          nextDisabled: !ok,
          hint,
        }}
      >
        {state.step === 1 && <PhotosStep state={state} dispatch={dispatch} />}
        {state.step === 2 && <OrderStep state={state} dispatch={dispatch} />}
        {state.step === 3 && <TopicStep state={state} dispatch={dispatch} onDone={() => go(4)} />}
        {state.step === 4 && <ComposeStep state={state} dispatch={dispatch} />}
        {state.step === 5 && (
          <ExportStep
            state={state}
            dispatch={dispatch}
            onDownload={() => download(state.cards.length, state.keyword)}
            onSave={() =>
              saveToFolder({
                count: state.cards.length,
                keyword: state.keyword,
                type: "cardnews",
                templateIds: state.cards.map((c) => c.layout),
              })
            }
          />
        )}
      </StudioShell>

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
