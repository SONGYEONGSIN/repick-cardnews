"use client";

import { Dropzone } from "@/features/photos/Dropzone";
import { PhotoGrid } from "@/features/photos/PhotoGrid";
import { CARDNEWS_MAX, CARDNEWS_MIN, type CardnewsAction, type CardnewsState } from "../reducer";

export function PhotosStep({
  state,
  dispatch,
}: {
  state: CardnewsState;
  dispatch: React.Dispatch<CardnewsAction>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <Dropzone
        hint={`카드뉴스는 사진 ${CARDNEWS_MIN}~${CARDNEWS_MAX}장으로 만들어요. 더 올려도 되고, 다음 단계에서 골라요.`}
        onPhotos={(photos) => dispatch({ type: "ADD_PHOTOS", photos })}
        onError={(error) => dispatch({ type: "SET_ERROR", error })}
      />

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      {state.photos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              올린 사진 <span className="tabular-nums text-ink-3">{state.photos.length}장</span>
            </h2>
            <p className="text-xs text-ink-3">누르면 빼요</p>
          </div>
          <PhotoGrid
            photos={state.photos}
            selectedIds={state.order}
            onToggle={(photoId) => dispatch({ type: "REMOVE_PHOTO", photoId })}
          />
        </section>
      )}
    </div>
  );
}
