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
      <Dropzone
        hint="여러 장 올린 뒤 대표로 쓸 한 장을 고르면 돼요."
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
