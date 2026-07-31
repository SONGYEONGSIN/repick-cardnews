"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { StudioShell } from "@/features/shell/StudioShell";
import type { StepDef } from "@/features/shell/types";
import { CaptureStage } from "@/features/studio/CaptureStage";
import { useExport } from "@/features/studio/useExport";
import { PhotoStep } from "./steps/PhotoStep";
import { TopicStep } from "./steps/TopicStep";
import { ComposeStep } from "./steps/ComposeStep";
import { ExportStep } from "./steps/ExportStep";
import { toRenderCard } from "./render";
import { canLeavePhoto, infoReducer, initialInfoState } from "./reducer";

const STEPS: StepDef[] = [
  { id: 1, label: "사진" },
  { id: 2, label: "주제" },
  { id: 3, label: "편집" },
  { id: 4, label: "내보내기" },
];

export function InfoFlow() {
  const [state, dispatch] = useReducer(infoReducer, initialInfoState);
  const router = useRouter();
  const { registerRef, download, saveToFolder } = useExport();

  const go = (step: number) => dispatch({ type: "SET_STEP", step });
  const card = toRenderCard(state);

  const gate = (): { ok: boolean; hint?: string } => {
    if (state.step === 1) {
      return canLeavePhoto(state) ? { ok: true } : { ok: false, hint: "대표로 쓸 사진 한 장을 골라 주세요." };
    }
    if (state.step === 2) {
      return state.spec ? { ok: true } : { ok: false, hint: "카피를 먼저 생성해 주세요." };
    }
    return { ok: true };
  };

  const { ok, hint } = gate();

  function exit() {
    const dirty = state.photos.length > 0;
    if (dirty && !window.confirm("만들던 정보전달 카드가 사라져요. 나갈까요?")) return;
    router.push("/");
  }

  return (
    <>
      <StudioShell
        flowLabel="정보전달"
        steps={STEPS}
        current={state.step}
        maxReached={state.maxReached}
        onSelectStep={go}
        meta={`사진 ${state.photos.length}장 · 항목 ${state.spec?.items.length ?? 0}개`}
        onReset={() => dispatch({ type: "RESET" })}
        onExit={exit}
        footer={{
          onPrev: state.step > 1 ? () => go(state.step - 1) : undefined,
          onNext: state.step < 4 ? () => go(state.step + 1) : undefined,
          nextDisabled: !ok,
          hint,
        }}
      >
        {state.step === 1 && <PhotoStep state={state} dispatch={dispatch} />}
        {state.step === 2 && <TopicStep state={state} dispatch={dispatch} onDone={() => go(3)} />}
        {state.step === 3 && <ComposeStep state={state} dispatch={dispatch} />}
        {state.step === 4 && (
          <ExportStep
            state={state}
            dispatch={dispatch}
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
      </StudioShell>

      {card && (
        <CaptureStage cards={[card]} themeId={state.themeId} handle={state.handle} registerRef={registerRef} />
      )}
    </>
  );
}
