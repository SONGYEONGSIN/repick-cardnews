"use client";

import { Dropzone } from "@/features/photos/Dropzone";
import { PhotoGrid } from "@/features/photos/PhotoGrid";
import type { InfoAction, InfoState } from "../reducer";

export function PhotoStep({
  state,
  dispatch,
}: {
  state: InfoState;
  dispatch: React.Dispatch<InfoAction>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      {/* 사진은 **선택**이다 — 없으면 제목을 테마 색 띠로 그린다. 예전엔 사진을 골라야만 다음으로
          갈 수 있어서(`canLeavePhoto`) 필수처럼 보였다. 그 사실을 화면에서도 말해 준다. */}
      <p className="text-[14px] leading-relaxed text-ink-2">
        <span className="font-bold text-ink">사진은 없어도 돼요.</span> 안 올리면 제목을 테마 색 띠로
        그려요. 올리면 그 자리에 사진이 들어가요.
      </p>

      <Dropzone
        hint="여러 장 올린 뒤 대표로 쓸 한 장을 고르면 돼요. 사진 없이 바로 다음으로 가도 돼요."
        onPhotos={(photos) => dispatch({ type: "ADD_PHOTOS", photos })}
        onError={(error) => dispatch({ type: "SET_ERROR", error })}
      />

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      {state.photos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">대표 사진 고르기</h2>
            <p className="tabular-nums text-xs text-ink-3">{state.photos.length}장</p>
          </div>
          <PhotoGrid
            photos={state.photos}
            selectedIds={state.selectedPhotoId ? [state.selectedPhotoId] : []}
            onToggle={(photoId) => dispatch({ type: "SELECT_PHOTO", photoId })}
          />
        </section>
      )}
    </div>
  );
}
